package kinds

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTagMetadata(t *testing.T) {
	tags := []string{"a", "b", "c"}
	m := GrafanaResourceMetadata{Name: "hello"}
	m.SetTags(tags)
	m.SetTitle("A title here")

	requireJSON(t, m, `{
		"name": "hello",
		"creationTimestamp": null,
		"annotations": {
		  "grafana.com/tags": "a,b,c",
		  "grafana.com/title": "A title here"
		}
	  }`)

	require.Equal(t, tags, m.GetTags())
	m.SetTitle("") // remove the property
	m.SetTags([]string{})

	requireJSON(t, m, `{
		"name": "hello",
		"creationTimestamp": null
	  }`)
}

func requireJSON(t *testing.T, obj interface{}, val string) {
	out, err := json.MarshalIndent(obj, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("OUT: %s", string(out))
	require.JSONEq(t, val, string(out))
}
