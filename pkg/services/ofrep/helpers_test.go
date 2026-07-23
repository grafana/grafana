package ofrep

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	goffmodel "github.com/thomaspoignant/go-feature-flag/cmd/relayproxy/model"
)

var openfeatureTestMutex sync.Mutex

// setupOpenFeatureFlag sets the global OpenFeature default provider to a static
// in-memory provider serving flag=value, and restores the noop provider on cleanup.
func setupOpenFeatureFlag(t *testing.T, flag string, value bool) {
	t.Helper()
	openfeatureTestMutex.Lock()

	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		flag: setting.NewInMemoryFlag(flag, value),
	})
	require.NoError(t, err)

	err = openfeature.SetProviderAndWait(provider)
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
}

func newSingleEvalBuilder(t *testing.T, metadata map[string]any) *APIBuilder {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		body, err := json.Marshal(goffmodel.OFREPEvaluateSuccessResponse{
			Key: "flag", Value: true, Reason: "STATIC", Metadata: metadata,
		})
		require.NoError(t, err)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return newTestBuilder(t, srv.URL)
}

func newBulkEvalBuilder(t *testing.T, flags []goffmodel.OFREPFlagBulkEvaluateSuccessResponse, status int) *APIBuilder {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		if status != http.StatusOK {
			return
		}
		body, err := json.Marshal(goffmodel.OFREPBulkEvaluateSuccessResponse{Flags: flags})
		require.NoError(t, err)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return newTestBuilder(t, srv.URL)
}

func newTestBuilder(t *testing.T, upstreamURL string) *APIBuilder {
	t.Helper()
	u, err := url.Parse(upstreamURL)
	require.NoError(t, err)
	return &APIBuilder{
		providerType: setting.OFREPProviderType,
		url:          u,
		logger:       log.NewNopLogger(),
		transport:    &http.Transport{},
	}
}

func newUnauthReq(target string, vars map[string]string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, target, bytes.NewBufferString(`{}`))
	req = mux.SetURLVars(req, vars)
	ctx := types.WithAuthInfo(req.Context(), &identity.StaticRequester{Type: types.TypeUnauthenticated})
	return req.WithContext(ctx)
}

func flagKeys(flags []goffmodel.OFREPFlagBulkEvaluateSuccessResponse) []string {
	keys := make([]string, 0, len(flags))
	for _, f := range flags {
		keys = append(keys, f.Key)
	}
	return keys
}
