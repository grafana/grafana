package generate_datasources

import (
	"net/http"
	"net/http/httptest"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCanGetCompatibleDatasources(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		w.WriteHeader(http.StatusOK)
		// response for getting metadata for all datasources
		if r.URL.String() == allPluginsEndpoint() {
			_, err = w.Write([]byte(`{"items":[{"slug":"postgres"},{"slug":"frontendDatasource"}]}`))
		}
		// responses for specific datasource plugins
		if r.URL.String() == pluginEndpoint("postgres") {
			_, err = w.Write([]byte(`{"json":{"alerting":true,"backend":true}}`))
		}
		if r.URL.String() == pluginEndpoint("frontendDatasource") {
			_, err = w.Write([]byte(`{"json":{}}`))
		}
		require.NoError(t, err)
	}))
	defer server.Close()

	datasources, err := GetCompatibleDatasources(server.URL)

	require.NoError(t, err)

	expectedDatasources := []string{"postgres"}
	expectedDatasources = append(expectedDatasources, grafanaDatasources...)
	sort.Strings(expectedDatasources)

	assert.Len(t, datasources, len(expectedDatasources))

	for i := range expectedDatasources {
		assert.Equal(t, expectedDatasources[i], datasources[i])
	}
}
