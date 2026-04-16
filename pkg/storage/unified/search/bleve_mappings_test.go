package search_test

import (
	"fmt"
	"testing"

	"github.com/blevesearch/bleve/v2/document"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func TestDocumentMapping(t *testing.T) {
	mappings, err := search.GetBleveMappings(nil, nil)
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
	require.Equal(t, 21, len(doc.Fields))
	require.False(t, doc.HasComposite(), "_all composite field should be disabled")
}

func TestDocValuesConfiguration(t *testing.T) {
	t.Run("DocValuesDynamic is disabled", func(t *testing.T) {
		mappings, err := search.GetBleveMappings(nil, nil)
		require.NoError(t, err)

		impl, ok := mappings.(*mapping.IndexMappingImpl)
		require.True(t, ok)
		assert.False(t, impl.DocValuesDynamic, "DocValuesDynamic should be false to prevent dynamic fields from getting DocValues")
	})

	t.Run("only folder and title_phrase have DocValues", func(t *testing.T) {
		mappings, err := search.GetBleveMappings(nil, nil)
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
