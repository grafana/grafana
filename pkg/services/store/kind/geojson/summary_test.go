package geojson

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGeoJSONSummary(t *testing.T) {
	builder := GetEntitySummaryBuilder()
	geo := []byte(`{"type":"FeatureCo`) // invalid
	_, _, err := builder(context.Background(), "hello", geo)
	require.Error(t, err)

	geo = []byte(`{"type":"FeatureCollection","features":[]}`)
	summary, out, err := builder(context.Background(), "hello", geo)
	require.NoError(t, err)
	require.NotEqual(t, geo, out) // wrote json

	asjson, err := json.MarshalIndent(summary, "", "  ")
	//fmt.Printf(string(asjson))
	require.NoError(t, err)
	require.JSONEq(t, `{
		"uid": "hello",
		"kind": "geojson",
		"name": "hello",
		"fields": {
			"type": "FeatureCollection",
			"count": 0
		}
	  }`, string(asjson))

	// Ignore gosec warning G304 since it's a test
	// nolint:gosec
	airports, err := os.ReadFile("../../../../../public/gazetteer/airports.geojson")
	require.NoError(t, err)
	summary, _, err = builder(context.Background(), "gaz/airports.geojson", airports)
	require.NoError(t, err)
	asjson, err = json.MarshalIndent(summary, "", "  ")
	//fmt.Printf(string(asjson))
	require.NoError(t, err)
	require.JSONEq(t, `{
		"uid": "gaz/airports.geojson",
		"kind": "geojson",
		"name": "airports",
		"fields": {
			"type": "FeatureCollection",
			"count": 888
		}
	  }`, string(asjson))
}
