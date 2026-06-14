package generate_datasources

import (
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

type closeTrackingBody struct {
	io.Reader
	closed *bool
}

func (b *closeTrackingBody) Close() error {
	*b.closed = true
	return nil
}

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

	expectedDatasources := []string{"postgres"} //nolint:prealloc
	expectedDatasources = append(expectedDatasources, grafanaDatasources...)
	sort.Strings(expectedDatasources)

	assert.Len(t, datasources, len(expectedDatasources))

	for i := range expectedDatasources {
		assert.Equal(t, expectedDatasources[i], datasources[i])
	}
}

func TestGetDatasourcePluginSlugsClosesBodyOnDecodeError(t *testing.T) {
	originalTransport := http.DefaultTransport
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	closed := false
	http.DefaultTransport = roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body: &closeTrackingBody{
				Reader: strings.NewReader("{"),
				closed: &closed,
			},
			Header: make(http.Header),
		}, nil
	})

	_, err := getDatasourcePluginSlugs("http://example.com")

	require.Error(t, err)
	require.True(t, closed)
}
