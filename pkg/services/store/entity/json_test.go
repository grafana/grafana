package entity

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/grn"
)

func TestRawEncoders(t *testing.T) {
	body, err := json.Marshal(map[string]any{
		"hello": "world",
		"field": 1.23,
	})
	require.NoError(t, err)

	raw := &Entity{
		GRN: &grn.GRN{
			ResourceIdentifier: "a",
			ResourceKind:       "b",
		},
		Version: "c",
		ETag:    "d",
		Body:    body,
	}

	b, err := json.MarshalIndent(raw, "", "  ")
	require.NoError(t, err)

	str := string(b)

	require.JSONEq(t, `{
		"GRN": {
		  "ResourceKind":       "b",
		  "ResourceIdentifier": "a"
		},
		"version": "c",
		"body": {
		  "field": 1.23,
		  "hello": "world"
		},
		"etag": "d"
	  }`, str)

	copy := &Entity{}
	err = json.Unmarshal(b, copy)
	require.NoError(t, err)
}
