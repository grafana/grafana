package search

import (
	"fmt"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2/document"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestDocumentMapping(t *testing.T) {
	mappings := getBleveMappings(nil)
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
			Identity: "nnn",
		},
		Source: &utils.SourceProperties{
			Path:      "ppp",
			Checksum:  "hhh",
			Timestamp: time.UnixMilli(1234),
		},
	}

	doc := document.NewDocument("id")
	err := mappings.MapDocument(doc, data)
	require.NoError(t, err)

	for _, f := range doc.Fields {
		fmt.Printf("%s = %+v\n", f.Name(), f.Value())
	}

	fmt.Printf("DOC: fields %d\n", len(doc.Fields))
	fmt.Printf("DOC: size %d\n", doc.Size())
	require.Equal(t, 13, len(doc.Fields))
}
