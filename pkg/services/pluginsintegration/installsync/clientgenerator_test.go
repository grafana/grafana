package installsync

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/services/apiserver"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestClientGeneratorDoesNotModifySharedRestConfig(t *testing.T) {
	shared := &clientrest.Config{Host: "http://example.com"}
	generator := ProvideClientGenerator(apiserver.RestConfigProviderFunc(func(context.Context) (*clientrest.Config, error) {
		return shared, nil
	})).(*clientGenerator)

	require.NoError(t, generator.init())
	require.Empty(t, shared.APIPath)
	require.Nil(t, shared.WrapTransport)
}

func TestFieldManagerRoundTripper(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			var gotFieldManager string
			next := roundTripFunc(func(req *http.Request) (*http.Response, error) {
				gotFieldManager = req.URL.Query().Get("fieldManager")
				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader("")),
					Header:     make(http.Header),
				}, nil
			})
			transport := fieldManagerRoundTripper{next: next}
			req, err := http.NewRequest(method, "http://example.com?fieldManager=caller", nil)
			require.NoError(t, err)

			resp, err := transport.RoundTrip(req)
			require.NoError(t, err)
			t.Cleanup(func() {
				require.NoError(t, resp.Body.Close())
			})

			if method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch {
				require.Equal(t, install.PluginStoreSyncServiceIdentity, gotFieldManager)
				require.Equal(t, "caller", req.URL.Query().Get("fieldManager"), "the shared request must not be mutated")
			} else {
				require.Equal(t, "caller", gotFieldManager)
			}
		})
	}
}
