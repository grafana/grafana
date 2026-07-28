package search_test

import (
	"fmt"
	"strings"
	"testing"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/document"
	"github.com/blevesearch/bleve/v2/index/scorch"
	"github.com/blevesearch/bleve/v2/index/scorch/mergeplan"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func TestDocumentMapping(t *testing.T) {
	mappings, err := search.GetBleveMappings(nil, "", "", nil)
	require.NoError(t, err)
	data := resource.IndexableDocument{
		Title:       "title",
		Description: "descr",
		Tags:        []string{"a", "b"},
		Created:     12345,
		Folder:      "xyz",
		CreatedBy:   "user:ryan",
		Labels: map[string]string{
			"a": "b",
			"x": "y",
		},
		RV: 1234,
		Manager: &utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "rrr",
		},
		Source: &utils.SourceProperties{
			Path:            "ppp",
			Checksum:        "ooo",
			TimestampMillis: 1234,
		},
		OwnerReferences: []string{"iam.grafana.app/Team/devops", "iam.grafana.app/User/xyz"},
	}
	data.UpdateCopyFields()

	doc := document.NewDocument("id")
	err = mappings.MapDocument(doc, data)
	require.NoError(t, err)

	for _, f := range doc.Fields {
		fmt.Printf("%s = %+v\n", f.Name(), f.Value())
	}

	fmt.Printf("DOC: fields %d\n", len(doc.Fields))
	fmt.Printf("DOC: size %d\n", doc.Size())
	// created and updated are int64 standard fields mapped as numbers, so they
	// are indexed alongside the string standard fields.
	require.Equal(t, 21, len(doc.Fields))
	require.False(t, doc.HasComposite(), "_all composite field should be disabled")
}

func TestTermVectorsAndFreqNorm(t *testing.T) {
	mappings, err := search.GetBleveMappings(nil, "", "", nil)
	require.NoError(t, err)

	data := resource.IndexableDocument{
		Title:       "title",
		Description: "descr",
		Tags:        []string{"a", "b"},
		Created:     12345,
		Folder:      "xyz",
		CreatedBy:   "user:ryan",
		Labels:      map[string]string{"a": "b"},
		RV:          1234,
		Manager:     &utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "rrr"},
		Source:      &utils.SourceProperties{Path: "ppp", Checksum: "ooo", TimestampMillis: 1234},
	}
	data.UpdateCopyFields()

	doc := document.NewDocument("id")
	err = mappings.MapDocument(doc, data)
	require.NoError(t, err)

	// Keyword/exact-match fields must skip freq/norm (no BM25 scoring needed).
	// description is in this bucket because the field is not scored today; the
	// SkipFreqNorm:true on its text mapping is an index-size optimization.
	mustSkipFreqNorm := map[string]bool{
		resource.SEARCH_FIELD_NAME:             true,
		resource.SEARCH_FIELD_TITLE_PHRASE:     true,
		resource.SEARCH_FIELD_DESCRIPTION:      true,
		resource.SEARCH_FIELD_TAGS:             true,
		resource.SEARCH_FIELD_OWNER_REFERENCES: true,
		resource.SEARCH_FIELD_CREATED_BY:       true,
		resource.SEARCH_FIELD_FOLDER:           true,
		resource.SEARCH_FIELD_MANAGED_BY:       true,
		"manager.kind":                         true,
		"manager.id":                           true,
		"source.path":                          true,
		"source.checksum":                      true,
		"source.timestampMillis":               true,
	}

	// Text fields that use MatchQuery with BM25 scoring must NOT skip freq/norm.
	mustNotSkipFreqNorm := map[string]bool{
		resource.SEARCH_FIELD_TITLE:       true,
		resource.SEARCH_FIELD_TITLE_NGRAM: true,
	}

	// Fields excluded from SkipFreqNorm check:
	// - "labels.*" uses dynamic mapping (separate issue)

	for _, f := range doc.Fields {
		name := f.Name()

		// Skip dynamically-mapped fields (not under our explicit control)
		if strings.HasPrefix(name, "labels.") {
			continue
		}

		// All explicitly-mapped fields must disable term vectors (no phrase queries or highlighting)
		assert.False(t, f.Options().IncludeTermVectors(),
			"field %q should not include term vectors", name)

		if mustSkipFreqNorm[name] {
			assert.True(t, f.Options().SkipFreqNorm(),
				"field %q should skip freq/norm (exact-match only)", name)
		}
		if mustNotSkipFreqNorm[name] {
			assert.False(t, f.Options().SkipFreqNorm(),
				"field %q needs freq/norm for BM25 scoring", name)
		}
	}
}

func TestTagsFacetPreservesMultiWordValues(t *testing.T) {
	mappings, err := search.GetBleveMappings(nil, "", "", nil)
	require.NoError(t, err)

	idx, err := bleve.NewMemOnly(mappings)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, idx.Close()) })

	doc := resource.IndexableDocument{Tags: []string{"US West"}}
	require.NoError(t, idx.Index("a", doc))

	req := bleve.NewSearchRequest(bleve.NewMatchAllQuery())
	req.Size = 0
	req.AddFacet("tags", bleve.NewFacetRequest(resource.SEARCH_FIELD_TAGS, 10))
	result, err := idx.Search(req)
	require.NoError(t, err)

	terms := result.Facets["tags"].Terms.Terms()
	require.Len(t, terms, 1)
	assert.Equal(t, "US West", terms[0].Term)
	assert.Equal(t, 1, terms[0].Count)
}

// TestStandardCreatedUpdatedAreNumeric guards that the int64 standard fields
// created and updated are stored as numbers and returned on retrieve: with a
// keyword mapping bleve dropped the numeric value entirely. They are
// retrieve-only (store, not index), so they are not queryable.
func TestStandardCreatedUpdatedAreNumeric(t *testing.T) {
	mappings, err := search.GetBleveMappings(nil, "", "", nil)
	require.NoError(t, err)

	idx, err := bleve.NewMemOnly(mappings)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, idx.Close()) })

	const created, updated = int64(1700000000123), int64(1700000009456)
	doc := resource.IndexableDocument{Title: "a", Created: created, Updated: updated}
	doc.UpdateCopyFields()
	require.NoError(t, idx.Index("a", doc))

	// Retrieve: both come back as float64 with the exact millis value.
	req := bleve.NewSearchRequest(bleve.NewMatchAllQuery())
	req.Fields = []string{"created", "updated"}
	res, err := idx.Search(req)
	require.NoError(t, err)
	require.Len(t, res.Hits, 1)
	assert.Equal(t, float64(created), res.Hits[0].Fields["created"])
	assert.Equal(t, float64(updated), res.Hits[0].Fields["updated"])

	// Retrieve-only: the field is stored but not indexed, so it is not
	// queryable (a numeric range query does not match).
	lo, hi := float64(created-1), float64(created+1)
	rangeQuery := bleve.NewNumericRangeQuery(&lo, &hi)
	rangeQuery.SetField("created")
	res, err = idx.Search(bleve.NewSearchRequest(rangeQuery))
	require.NoError(t, err)
	assert.Equal(t, uint64(0), res.Total)
}

func TestStoredTitleSurvivesMergeAfterDelete(t *testing.T) {
	mappings, err := search.GetBleveMappings(nil, "", "", nil)
	require.NoError(t, err)

	idx, err := bleve.NewUsing(t.TempDir(), mappings, bleve.Config.DefaultIndexType, bleve.Config.DefaultKVStore, nil)
	require.NoError(t, err)
	defer func() { require.NoError(t, idx.Close()) }()

	const docCount = 3000
	batch := idx.NewBatch()
	for i := range docCount {
		title := fmt.Sprintf("Dashboard title %04d", i)
		doc := resource.IndexableDocument{
			Name:        fmt.Sprintf("dash-%05d", i),
			Title:       title,
			Description: "description",
			Folder:      "folder",
		}
		doc.UpdateCopyFields()

		require.NoError(t, batch.Index(fmt.Sprintf("id-%05d", i), doc))
		if batch.Size() >= 1000 {
			require.NoError(t, idx.Batch(batch))
			batch = idx.NewBatch()
		}
	}
	if batch.Size() > 0 {
		require.NoError(t, idx.Batch(batch))
	}

	require.NoError(t, idx.Delete("id-01000"))

	advancedIndex, err := idx.Advanced()
	require.NoError(t, err)

	// Grafana creates indexes with Bleve's default index type, which is Scorch.
	// Merges normally happen in the background; ForceMerge makes that path deterministic for this test.
	advanced, ok := advancedIndex.(*scorch.Scorch)
	require.True(t, ok)
	require.NoError(t, advanced.ForceMerge(t.Context(), &mergeplan.SingleSegmentMergePlanOptions))

	query := bleve.NewMatchQuery("dashboard")
	query.SetField(resource.SEARCH_FIELD_TITLE)
	req := bleve.NewSearchRequestOptions(query, docCount, 0, false)
	req.Fields = []string{resource.SEARCH_FIELD_TITLE}

	result, err := idx.Search(req)
	require.NoError(t, err)
	require.Equal(t, uint64(docCount-1), result.Total)

	missingTitles := 0
	missingTitleExamples := make([]string, 0, 10)
	for _, hit := range result.Hits {
		title, ok := hit.Fields[resource.SEARCH_FIELD_TITLE].(string)
		if !ok || title == "" {
			missingTitles++
			if len(missingTitleExamples) < cap(missingTitleExamples) {
				missingTitleExamples = append(missingTitleExamples, hit.ID)
			}
		}
	}

	// Dashboard search can still match indexed title terms when this regresses,
	// but clients display the stored title returned in the search hit.
	require.Zero(t, missingTitles, "stored title missing for %d docs; examples: %v", missingTitles, missingTitleExamples)
}

func TestDocValuesConfiguration(t *testing.T) {
	t.Run("DocValuesDynamic is disabled", func(t *testing.T) {
		mappings, err := search.GetBleveMappings(nil, "", "", nil)
		require.NoError(t, err)

		impl, ok := mappings.(*mapping.IndexMappingImpl)
		require.True(t, ok)
		assert.False(t, impl.DocValuesDynamic, "DocValuesDynamic should be false to prevent dynamic fields from getting DocValues")
	})

	t.Run("only sortable fields have DocValues", func(t *testing.T) {
		mappings, err := search.GetBleveMappings(nil, "", "", nil)
		require.NoError(t, err)

		data := resource.IndexableDocument{
			Title:       "title",
			Description: "descr",
			Tags:        []string{"a", "b"},
			Created:     12345,
			Folder:      "xyz",
			CreatedBy:   "user:ryan",
			Labels:      map[string]string{"a": "b"},
			RV:          1234,
			Manager:     &utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "rrr"},
			Source:      &utils.SourceProperties{Path: "ppp", Checksum: "ooo", TimestampMillis: 1234},
		}
		data.UpdateCopyFields()

		doc := document.NewDocument("id")
		err = mappings.MapDocument(doc, data)
		require.NoError(t, err)

		fieldsWithDocValues := map[string]bool{
			resource.SEARCH_FIELD_NAME:         true,
			resource.SEARCH_FIELD_FOLDER:       true,
			resource.SEARCH_FIELD_TITLE_PHRASE: true,
		}

		for _, f := range doc.Fields {
			hasDocValues := f.Options().IncludeDocValues()
			if fieldsWithDocValues[f.Name()] {
				assert.True(t, hasDocValues, "field %q should have DocValues enabled", f.Name())
			} else {
				assert.False(t, hasDocValues, "field %q should not have DocValues enabled", f.Name())
			}
		}
	})
}
