package rulesync

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/validations"
)

func newTestFetcher() *RulerFetcher {
	return NewRulerFetcher(&dsfakes.FakeDataSourceService{}, httpclient.NewProvider(), &validations.OSSDataSourceRequestValidator{})
}

// rulerServer starts an httptest server that serves the given handler at the
// ruler config API path and returns a datasource pointing at it.
func rulerServer(t *testing.T, handler http.HandlerFunc) *datasources.DataSource {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc(rulerConfigAPIPath, handler)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &datasources.DataSource{UID: "ds1", OrgID: 1, Type: datasources.DS_PROMETHEUS, URL: srv.URL}
}

func TestRulerFetcher_Fetch(t *testing.T) {
	ctx := context.Background()

	t.Run("parses namespace-grouped rule configs", func(t *testing.T) {
		want := RulerConfig{
			"ns1": {{Name: "group1", Rules: []apimodels.PrometheusRule{{Alert: "A", Expr: "up == 0"}}}},
			"ns2": {{Name: "group2", Rules: []apimodels.PrometheusRule{{Record: "r", Expr: "vector(1)"}}}},
		}
		ds := rulerServer(t, func(w http.ResponseWriter, _ *http.Request) {
			body, err := yaml.Marshal(want)
			require.NoError(t, err)
			w.Header().Set("Content-Type", "application/yaml")
			_, _ = w.Write(body)
		})

		got, hash, err := newTestFetcher().Fetch(ctx, ds)
		require.NoError(t, err)
		assert.NotZero(t, hash)
		require.Len(t, got, 2)
		require.Len(t, got["ns1"], 1)
		assert.Equal(t, "group1", got["ns1"][0].Name)
		require.Len(t, got["ns1"][0].Rules, 1)
		assert.Equal(t, "A", got["ns1"][0].Rules[0].Alert)
		assert.Equal(t, "group2", got["ns2"][0].Name)
	})

	t.Run("404 yields an empty config and no error (empty ruler)", func(t *testing.T) {
		ds := rulerServer(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "no rule groups found", http.StatusNotFound)
		})

		got, hash, err := newTestFetcher().Fetch(ctx, ds)
		require.NoError(t, err)
		assert.Empty(t, got)
		assert.Equal(t, emptyHash, hash)
	})

	t.Run("non-2xx (not 404) is ErrNotARuler", func(t *testing.T) {
		ds := rulerServer(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "boom", http.StatusInternalServerError)
		})

		_, _, err := newTestFetcher().Fetch(ctx, ds)
		assert.ErrorIs(t, err, ErrNotARuler)
	})

	t.Run("200 with unparseable body is ErrNotARuler", func(t *testing.T) {
		ds := rulerServer(t, func(w http.ResponseWriter, _ *http.Request) {
			// A YAML scalar cannot unmarshal into map[string][]PrometheusRuleGroup.
			_, _ = w.Write([]byte("just a string, not a ruler config"))
		})

		_, _, err := newTestFetcher().Fetch(ctx, ds)
		assert.ErrorIs(t, err, ErrNotARuler)
	})

	t.Run("hash is stable for identical responses (dedup)", func(t *testing.T) {
		body := func(w http.ResponseWriter, _ *http.Request) {
			out, _ := yaml.Marshal(RulerConfig{"ns": {{Name: "g", Rules: []apimodels.PrometheusRule{{Alert: "A", Expr: "up"}}}}})
			_, _ = w.Write(out)
		}
		ds := rulerServer(t, body)
		f := newTestFetcher()

		_, h1, err := f.Fetch(ctx, ds)
		require.NoError(t, err)
		_, h2, err := f.Fetch(ctx, ds)
		require.NoError(t, err)
		assert.Equal(t, h1, h2)
		assert.NotEqual(t, emptyHash, h1)
	})
}

func TestBuildRulerConfigURL(t *testing.T) {
	// The config path is appended to the datasource URL, preserving any
	// Prometheus HTTP prefix the user configured (e.g. /prometheus).
	ds := &datasources.DataSource{URL: "http://mimir:9009/prometheus"}
	got, err := buildRulerConfigURL(ds)
	require.NoError(t, err)
	assert.Equal(t, "http://mimir:9009/prometheus/config/v1/rules", got)
}
