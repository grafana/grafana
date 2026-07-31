package rulesync

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// fakeDatasourceProxy stands in for *datasourceproxy.DataSourceProxyService. It
// records the request it received and writes a canned status + body into the
// ReqContext's ResponseWriter, simulating the proxied datasource response —
// letting the fetcher be unit-tested without a live datasource or the full proxy
// stack.
type fakeDatasourceProxy struct {
	status int
	body   []byte

	// if apiErr is set, respond via ReqContext.JsonApiErr (which logs via
	// c.Logger), mimicking the real proxy's error paths (datasource not found,
	// access denied, plugin load).
	apiErrStatus int
	apiErr       error

	// captured from the most recent call
	gotUID  string
	gotPath string
	calls   int
}

func (f *fakeDatasourceProxy) ProxyDatasourceRequestWithUID(c *contextmodel.ReqContext, dsUID string) {
	f.calls++
	f.gotUID = dsUID
	f.gotPath = c.Req.URL.Path

	if f.apiErr != nil {
		c.JsonApiErr(f.apiErrStatus, "proxy error", f.apiErr)
		return
	}

	status := f.status
	if status == 0 {
		status = http.StatusOK
	}
	c.Resp.WriteHeader(status)
	_, _ = c.Resp.Write(f.body)
}

func testDS() *datasources.DataSource {
	return &datasources.DataSource{UID: "ds1", OrgID: 1, Type: datasources.DS_PROMETHEUS, URL: "http://mimir:9009/prometheus"}
}

func TestRulerFetcher_Fetch(t *testing.T) {
	ctx := context.Background()

	t.Run("parses namespace-grouped rule configs", func(t *testing.T) {
		want := RulerConfig{
			"ns1": {{Name: "group1", Rules: []apimodels.PrometheusRule{{Alert: "A", Expr: "up == 0"}}}},
			"ns2": {{Name: "group2", Rules: []apimodels.PrometheusRule{{Record: "r", Expr: "vector(1)"}}}},
		}
		body, err := yaml.Marshal(want)
		require.NoError(t, err)
		proxy := &fakeDatasourceProxy{status: http.StatusOK, body: body}

		got, hash, err := NewRulerFetcher(proxy, log.NewNopLogger()).Fetch(ctx, testDS())
		require.NoError(t, err)
		assert.NotZero(t, hash)
		require.Len(t, got, 2)
		require.Len(t, got["ns1"], 1)
		assert.Equal(t, "group1", got["ns1"][0].Name)
		require.Len(t, got["ns1"][0].Rules, 1)
		assert.Equal(t, "A", got["ns1"][0].Rules[0].Alert)
		assert.Equal(t, "group2", got["ns2"][0].Name)
	})

	t.Run("routes through the proxy with the expected uid and path", func(t *testing.T) {
		proxy := &fakeDatasourceProxy{status: http.StatusOK, body: []byte("{}")}

		_, _, err := NewRulerFetcher(proxy, log.NewNopLogger()).Fetch(ctx, testDS())
		require.NoError(t, err)
		assert.Equal(t, 1, proxy.calls)
		assert.Equal(t, "ds1", proxy.gotUID)
		// The proxy strips /api/datasources/proxy/uid/<uid>/ to derive the upstream
		// path, so the config path must sit after that prefix.
		assert.Equal(t, "/api/datasources/proxy/uid/ds1/config/v1/rules", proxy.gotPath)
	})

	t.Run("404 yields an empty config and no error (empty ruler)", func(t *testing.T) {
		proxy := &fakeDatasourceProxy{status: http.StatusNotFound, body: []byte("no rule groups found")}

		got, hash, err := NewRulerFetcher(proxy, log.NewNopLogger()).Fetch(ctx, testDS())
		require.NoError(t, err)
		assert.Empty(t, got)
		assert.Equal(t, emptyHash, hash)
	})

	t.Run("non-2xx (not 404) is a fetch error, not ErrNotARuler", func(t *testing.T) {
		proxy := &fakeDatasourceProxy{status: http.StatusInternalServerError, body: []byte("boom")}

		_, _, err := NewRulerFetcher(proxy, log.NewNopLogger()).Fetch(ctx, testDS())
		require.Error(t, err)
		assert.NotErrorIs(t, err, ErrNotARuler)
	})

	t.Run("proxy error path does not panic (nil-logger regression)", func(t *testing.T) {
		// The real proxy calls ReqContext.JsonApiErr on failures, which logs via
		// c.Logger; Fetch must supply a non-nil logger or this panics.
		proxy := &fakeDatasourceProxy{apiErrStatus: http.StatusForbidden, apiErr: errors.New("access denied")}

		_, _, err := NewRulerFetcher(proxy, log.NewNopLogger()).Fetch(ctx, testDS())
		require.Error(t, err)
		assert.NotErrorIs(t, err, ErrNotARuler)
	})

	t.Run("200 with unparseable body is ErrNotARuler", func(t *testing.T) {
		// A YAML scalar cannot unmarshal into map[string][]PrometheusRuleGroup.
		proxy := &fakeDatasourceProxy{status: http.StatusOK, body: []byte("just a string, not a ruler config")}

		_, _, err := NewRulerFetcher(proxy, log.NewNopLogger()).Fetch(ctx, testDS())
		assert.ErrorIs(t, err, ErrNotARuler)
	})

	t.Run("hash is stable for identical responses (dedup)", func(t *testing.T) {
		body, err := yaml.Marshal(RulerConfig{"ns": {{Name: "g", Rules: []apimodels.PrometheusRule{{Alert: "A", Expr: "up"}}}}})
		require.NoError(t, err)
		proxy := &fakeDatasourceProxy{status: http.StatusOK, body: body}
		f := NewRulerFetcher(proxy, log.NewNopLogger())

		_, h1, err := f.Fetch(ctx, testDS())
		require.NoError(t, err)
		_, h2, err := f.Fetch(ctx, testDS())
		require.NoError(t, err)
		assert.Equal(t, h1, h2)
		assert.NotEqual(t, emptyHash, h1)
	})
}
