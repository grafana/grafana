package kinds

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTagMetadata(t *testing.T) {
	tags := []string{"a", "b", "c,d"}
	m := GrafanaResourceMetadata{Name: "hello"}
	m.SetTags(tags)
	m.SetTitle("A title here")

	requireJSON(t, m, `{
		"name": "hello",
		"creationTimestamp": null,
		"annotations": {
		  "grafana.com/tags": "a,b,c-d",
		  "grafana.com/title": "A title here"
		}
	  }`)

	require.Equal(t, []string{"a", "b", "c-d"}, m.GetTags())
	m.SetTitle("") // remove the property
	m.SetTags([]string{})

	requireJSON(t, m, `{
		"name": "hello",
		"creationTimestamp": null
	  }`)

	m.Annotations[annoKeyTags] = "hello, world"
	requireJSON(t, m, `{
		"name": "hello",
		"creationTimestamp": null,
		"annotations": {
		  "grafana.com/tags": "hello, world"
		}
	  }`)
	require.Equal(t, []string{"hello", "world"}, m.GetTags())
}

func requireJSON(t *testing.T, obj interface{}, val string) {
	out, err := json.MarshalIndent(obj, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("OUT: %s", string(out))
	require.JSONEq(t, val, string(out))
}
