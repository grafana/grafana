package ofrep

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestProxyUserAgent(t *testing.T) {
	tests := []struct {
		name              string
		namespace         string
		expectedUserAgent string
	}{
		{
			name:              "sets namespace-scoped user agent",
			namespace:         "stacks-1234",
			expectedUserAgent: "features-grafana-app/stacks-1234",
		},
		{
			name:              "falls back to service name when namespace is empty",
			namespace:         "",
			expectedUserAgent: "features-grafana-app",
		},
	}

	newUARecordingServer := func(t *testing.T) (*httptest.Server, *string) {
		t.Helper()
		var receivedUA string
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedUA = r.Header.Get("User-Agent")
			_, _ = io.WriteString(w, `{"flags":[]}`)
		}))
		t.Cleanup(srv.Close)
		return srv, &receivedUA
	}

	newBuilder := func(t *testing.T, upstream *httptest.Server) *APIBuilder {
		t.Helper()
		u, err := url.Parse(upstream.URL)
		require.NoError(t, err)
		return &APIBuilder{
			providerType: setting.FeaturesServiceProviderType,
			url:          u,
			logger:       log.New("test"),
			transport:    &http.Transport{},
		}
	}

	t.Run("single flag", func(t *testing.T) {
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				upstream, receivedUA := newUARecordingServer(t)
				b := newBuilder(t, upstream)
				w := httptest.NewRecorder()
				r := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags/myflag", strings.NewReader(`{}`))
				b.proxyFlagReq(r.Context(), "myflag", true, tc.namespace, w, r)
				assert.Equal(t, tc.expectedUserAgent, *receivedUA)
			})
		}
	})

	t.Run("all flags", func(t *testing.T) {
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				upstream, receivedUA := newUARecordingServer(t)
				b := newBuilder(t, upstream)
				w := httptest.NewRecorder()
				r := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags", strings.NewReader(`{}`))
				b.proxyAllFlagReq(r.Context(), true, tc.namespace, w, r)
				assert.Equal(t, tc.expectedUserAgent, *receivedUA)
			})
		}
	})
}
