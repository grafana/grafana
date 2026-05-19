package search

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2/index/scorch"
	"github.com/blevesearch/bleve/v2/index/scorch/mergeplan"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

type expectedDashboardSearchFields struct {
	title       string
	folder      string
	description string
	createdBy   string
	tags        []string
}

func TestDashboardSearchStoredFieldsSurviveFileIndexMutationsAndMerge(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	const (
		operationCount = 10000
		batchSize      = 500
	)

	seed := dashboardSearchLifecycleSeed(t)
	rng := rand.New(rand.NewSource(seed)) //nolint:gosec
	t.Logf("dashboard search lifecycle random seed: %d (set GRAFANA_SEARCH_LIFECYCLE_SEED to reproduce)", seed)

	idx := newFileBackedDashboardIndex(t, key, operationCount)
	expectedDocs := make(map[string]expectedDashboardSearchFields, operationCount)
	deletedNames := map[string]struct{}{}
	liveNames := make([]string, 0, operationCount)

	keyFor := func(name string) *resourcepb.ResourceKey {
		return &resourcepb.ResourceKey{
			Name:      name,
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}
	}
	nameFor := func(i int) string {
		return fmt.Sprintf("dash-%05d", i)
	}
	docFor := func(op int, name string, title string) (*resource.IndexableDocument, expectedDashboardSearchFields) {
		expected := expectedDashboardSearchFields{
			title:       title,
			folder:      fmt.Sprintf("folder-%02d", op%17),
			description: fmt.Sprintf("Lifecycle description op-%05d %s", op, name),
			createdBy:   fmt.Sprintf("user:%d", op%23),
			tags:        []string{"lifecycle", fmt.Sprintf("bucket-%02d", op%7)},
		}
		return &resource.IndexableDocument{
			RV:          int64(op + 1),
			Name:        name,
			Key:         keyFor(name),
			Title:       expected.title,
			Description: expected.description,
			Folder:      expected.folder,
			CreatedBy:   expected.createdBy,
			Tags:        expected.tags,
		}, expected
	}

	batch := make([]*resource.BulkIndexItem, 0, batchSize)
	batchTouched := make(map[string]struct{}, batchSize)
	flushBatch := func() {
		t.Helper()
		if len(batch) == 0 {
			return
		}
		require.NoError(t, idx.BulkIndex(&resource.BulkIndexRequest{Items: batch}))
		batch = batch[:0]
		clear(batchTouched)
	}
	addToBatch := func(name string, item *resource.BulkIndexItem) {
		t.Helper()
		if _, ok := batchTouched[name]; ok {
			flushBatch()
		}
		batch = append(batch, item)
		batchTouched[name] = struct{}{}
		if len(batch) >= batchSize {
			flushBatch()
		}
	}

	pickLiveName := func() (string, int) {
		t.Helper()
		require.NotEmpty(t, liveNames)
		idx := rng.Intn(len(liveNames))
		return liveNames[idx], idx
	}
	removeLiveName := func(idx int) {
		liveNames[idx] = liveNames[len(liveNames)-1]
		liveNames = liveNames[:len(liveNames)-1]
	}

	var adds, updates, deletes int
	nextDocID := 0
	for op := range operationCount {
		operation := rng.Intn(100)
		switch {
		case len(liveNames) == 0 || operation < 50:
			// Add new dashboards so the index grows enough to create multiple file-backed segments.
			docID := nextDocID
			nextDocID++
			name := nameFor(docID)
			title := fmt.Sprintf("Lifecycle dashboard added op-%05d doc-%05d", op, docID)
			doc, expected := docFor(op, name, title)
			expectedDocs[name] = expected
			delete(deletedNames, name)
			liveNames = append(liveNames, name)
			addToBatch(name, &resource.BulkIndexItem{
				Action: resource.ActionIndex,
				Doc:    doc,
			})
			adds++

		case operation < 80:
			// Update existing dashboards to verify stored fields do not become stale after merge.
			name, _ := pickLiveName()
			title := fmt.Sprintf("Lifecycle dashboard updated op-%05d %s", op, name)
			doc, expected := docFor(op, name, title)
			expectedDocs[name] = expected
			addToBatch(name, &resource.BulkIndexItem{
				Action: resource.ActionIndex,
				Doc:    doc,
			})
			updates++

		default:
			// Delete existing dashboards to force merge to reconcile removed documents with stored fields.
			name, liveIdx := pickLiveName()
			delete(expectedDocs, name)
			deletedNames[name] = struct{}{}
			removeLiveName(liveIdx)
			addToBatch(name, &resource.BulkIndexItem{
				Action: resource.ActionDelete,
				Key:    keyFor(name),
			})
			deletes++
		}
	}
	flushBatch()
	t.Logf("dashboard search lifecycle operations: adds=%d updates=%d deletes=%d live=%d", adds, updates, deletes, len(expectedDocs))
	require.Positive(t, adds)
	require.Positive(t, updates)
	require.Positive(t, deletes)
	require.NotEmpty(t, expectedDocs)

	forceScorchMerge(t, idx)

	res, err := idx.Search(t.Context(), nil, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
		},
		Limit: operationCount,
		Query: "lifecycle dashboard",
		Fields: []string{
			resource.SEARCH_FIELD_TITLE,
			resource.SEARCH_FIELD_FOLDER,
			resource.SEARCH_FIELD_DESCRIPTION,
			resource.SEARCH_FIELD_CREATED_BY,
			resource.SEARCH_FIELD_TAGS,
		},
	}, nil, nil)
	require.NoError(t, err)
	require.Nil(t, res.Error)
	require.Equal(t, int64(len(expectedDocs)), res.TotalHits)
	require.Len(t, res.Results.Rows, len(expectedDocs))

	columnIndexes := map[string]int{}
	for i, column := range res.Results.Columns {
		columnIndexes[column.Name] = i
	}
	titleColumn := requireColumn(t, columnIndexes, resource.SEARCH_FIELD_TITLE)
	folderColumn := requireColumn(t, columnIndexes, resource.SEARCH_FIELD_FOLDER)
	descriptionColumn := requireColumn(t, columnIndexes, resource.SEARCH_FIELD_DESCRIPTION)
	createdByColumn := requireColumn(t, columnIndexes, resource.SEARCH_FIELD_CREATED_BY)
	tagsColumn := requireColumn(t, columnIndexes, resource.SEARCH_FIELD_TAGS)

	seen := make(map[string]struct{}, len(res.Results.Rows))
	for _, row := range res.Results.Rows {
		name := row.Key.Name
		expected, ok := expectedDocs[name]
		require.True(t, ok, "unexpected search result %q", name)

		title := string(row.Cells[titleColumn])
		require.NotEmpty(t, title, "stored title missing for %q", name)
		require.Equal(t, expected.title, title, "stored title should match latest indexed title for %q", name)
		require.Equal(t, expected.folder, string(row.Cells[folderColumn]), "stored folder should match latest indexed folder for %q", name)
		require.Equal(t, expected.description, string(row.Cells[descriptionColumn]), "stored description should match latest indexed description for %q", name)
		require.Equal(t, expected.createdBy, string(row.Cells[createdByColumn]), "stored createdBy should match latest indexed createdBy for %q", name)

		storedTags, err := resource.DecodeCell(res.Results.Columns[tagsColumn], tagsColumn, row.Cells[tagsColumn])
		require.NoError(t, err)
		require.Equal(t, expected.tags, stringsFromAnySlice(t, storedTags), "stored tags should match latest indexed tags for %q", name)
		seen[name] = struct{}{}
	}

	for name := range deletedNames {
		_, ok := seen[name]
		require.False(t, ok, "deleted dashboard %q should not be returned", name)
	}
}

func requireColumn(t *testing.T, columnIndexes map[string]int, name string) int {
	t.Helper()

	idx, ok := columnIndexes[name]
	require.True(t, ok, "search response should include the stored %s field", name)
	return idx
}

func stringsFromAnySlice(t *testing.T, v any) []string {
	t.Helper()

	items, ok := v.([]any)
	require.True(t, ok)

	result := make([]string, 0, len(items))
	for _, item := range items {
		str, ok := item.(string)
		require.True(t, ok)
		result = append(result, str)
	}
	return result
}

func dashboardSearchLifecycleSeed(t *testing.T) int64 {
	t.Helper()

	const seedEnv = "GRAFANA_SEARCH_LIFECYCLE_SEED"
	if seedValue := os.Getenv(seedEnv); seedValue != "" {
		seed, err := strconv.ParseInt(seedValue, 10, 64)
		require.NoError(t, err, "invalid %s", seedEnv)
		return seed
	}
	return time.Now().UnixNano()
}

func newFileBackedDashboardIndex(t *testing.T, key resource.NamespacedResource, docCount int64) *bleveIndex {
	t.Helper()

	backend, _ := setupBleveBackend(t, withFileThreshold(1))
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: key.Namespace})

	info, err := builders.DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		return &builders.DashboardDocumentBuilder{
			Namespace:        namespace,
			Blob:             blob,
			Stats:            make(map[string]map[string]int64),
			DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{{}}),
		}, nil
	})
	require.NoError(t, err)

	resourceIndex, err := backend.BuildIndex(ctx, key, docCount, info.Fields, "test", func(index resource.ResourceIndex) (int64, error) {
		return 0, nil
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	idx, ok := resourceIndex.(*bleveIndex)
	require.True(t, ok)
	require.Equal(t, indexStorageFile, idx.indexStorage)
	return idx
}

func forceScorchMerge(t *testing.T, idx *bleveIndex) {
	t.Helper()

	advancedIndex, err := idx.index.Advanced()
	require.NoError(t, err)

	scorchIndex, ok := advancedIndex.(*scorch.Scorch)
	require.True(t, ok)
	require.NoError(t, scorchIndex.ForceMerge(t.Context(), &mergeplan.SingleSegmentMergePlanOptions))
}
