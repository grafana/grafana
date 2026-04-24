package v0alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestDataSourceToFromUnstructured(t *testing.T) {
	body := `{
		"apiVersion": "xxx.datasource/vXyz",
		"kind": "Datasource",
		"metadata": { "name": "test" },
		"spec": {
			"title": "Infinity Aha",
			"url": "/api/xyz",
			"isDefault": false,
			"access": "proxy",
			"preload": false,
			"jsonData": {
				"allowedHosts": ["https://grafana-labs.aha.io/"],
				"apiKeyKey": "a",
				"auth_method": "bearerToken",
				"global_queries": [],
				"oauthPassThru": false,
				"pdcInjected": true
			},
			"readOnly": false,
			"cachingConfig": { "enabled": false, "TTLMs": 0 }
		},
		"secure": {
			"aaa": { "create": "AAA" },
			"bbb": { "name": "BBB" },
			"ccc": { "remove": true }
		}
	}`

	t.Run("unstructured-to-typed-and-back", func(t *testing.T) {
		obj := &unstructured.Unstructured{}
		err := obj.UnmarshalJSON([]byte(body))
		require.NoError(t, err)
		require.Equal(t, "test", obj.GetName())

		ds, err := FromUnstructured(obj)
		require.NoError(t, err)
		require.Equal(t, "test", ds.GetName())
		require.Equal(t, "/api/xyz", ds.Spec.URL())
		require.Equal(t, false, ds.Spec.IsDefault())
		require.Equal(t, DsAccessProxy, ds.Spec.Access())

		after, err := ds.ToUnstructured()
		require.NoError(t, err)
		require.Equal(t, obj, after)
	})

	t.Run("typed-to-unstructured-and-back", func(t *testing.T) {
		ds := &DataSource{}
		err := json.Unmarshal([]byte(body), ds)
		require.NoError(t, err)
		require.Equal(t, "test", ds.GetName())
		require.Equal(t, "/api/xyz", ds.Spec.URL())
		require.Equal(t, false, ds.Spec.IsDefault())
		require.Equal(t, DsAccessProxy, ds.Spec.Access())

		obj, err := ds.ToUnstructured()
		require.NoError(t, err)
		require.Equal(t, "test", obj.GetName())

		after, err := FromUnstructured(obj)
		require.NoError(t, err)
		require.Equal(t, ds, after)
	})
}
