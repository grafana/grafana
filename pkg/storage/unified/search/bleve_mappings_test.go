package search

import (
	"fmt"
	"testing"

	"github.com/blevesearch/bleve/v2/document"
	"github.com/stretchr/testify/require"
)

func TestDocumentMapping(t *testing.T) {
	gr := "xxx/yyy"
	mappings := getBleveMappings(gr, nil)
	data := bleveFlatDocument{
		GR:        gr,
		Title:     "title",
		TitleSort: "title",
		Tags:      []string{"a", "b"},
	}

	doc := document.NewDocument("id")
	err := mappings.MapDocument(doc, data)
	require.NoError(t, err)

	for _, f := range doc.Fields {
		fmt.Printf("%s = %+v\n", f.Name(), f.Value())
	}

	fmt.Printf("DOC: fields %d\n", len(doc.Fields))
	fmt.Printf("DOC: size %d\n", doc.Size())
	require.Equal(t, 7, len(doc.Fields))
}
