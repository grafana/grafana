package trigram

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSearch(t *testing.T) {
	tests := map[string]SearchResult{
		"":    {Resources: []string{}},
		"foo": {Resources: []string{"dashboard/1"}},
	}

	storage := &inmemory{}
	err := storage.Set(TrigramKey{
		Trigram:  "foo",
		Resource: "dashboard/1",
		Type:     "title",
	}, 1)
	require.NoError(t, err)

	svc := SearchService{storage: storage}

	for phrase, expected := range tests {
		res, err := svc.Search(phrase)
		require.NoError(t, err)
		assert.EqualValues(t, expected, res)
	}
}
