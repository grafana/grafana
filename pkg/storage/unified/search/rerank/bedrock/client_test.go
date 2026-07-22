package bedrock

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRerankRequestBody(t *testing.T) {
	body, err := json.Marshal(rerankRequest{
		APIVersion: 2,
		Query:      "q",
		Documents:  []string{"a", "b"},
	})
	require.NoError(t, err)
	assert.JSONEq(t, `{"api_version":2,"query":"q","documents":["a","b"]}`, string(body))
}

func TestRerankResponseParsing(t *testing.T) {
	var resp rerankResponse
	require.NoError(t, json.Unmarshal(
		[]byte(`{"results":[{"index":1,"relevance_score":0.87},{"index":0,"relevance_score":0.12}]}`),
		&resp,
	))
	require.Len(t, resp.Results, 2)
	assert.Equal(t, 1, resp.Results[0].Index)
	assert.Equal(t, 0.87, resp.Results[0].Score)
}
