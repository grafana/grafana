package dsproxyfetch

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// fakeProxy stands in for *datasourceproxy.DataSourceProxyService. It records
// the request/identity it received and writes a canned status + body into the
// ReqContext's ResponseWriter, simulating the proxied datasource response.
type fakeProxy struct {
	status int
	body   []byte

	// if apiErr is set, respond via ReqContext.JsonApiErr (which logs via
	// c.Logger), mimicking the real proxy's error paths.
	apiErrStatus int
	apiErr       error

	gotUID    string
	gotPath   string
	gotAccept string
	gotUser   string
	gotOrgID  int64
	gotPerms  map[int64]map[string][]string
	calls     int
}

func (f *fakeProxy) ProxyDatasourceRequestWithUID(c *contextmodel.ReqContext, dsUID string) {
	f.calls++
	f.gotUID = dsUID
	f.gotPath = c.Req.URL.Path
	f.gotAccept = c.Req.Header.Get("Accept")
	f.gotUser = c.SignedInUser.Login
	f.gotOrgID = c.SignedInUser.OrgID
	f.gotPerms = c.SignedInUser.Permissions

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
	return &datasources.DataSource{UID: "ds1", OrgID: 7, Type: datasources.DS_PROMETHEUS, URL: "http://mimir:9009/prometheus"}
}

func TestGet_RoutesThroughProxyWithExpectedUIDAndPath(t *testing.T) {
	proxy := &fakeProxy{status: http.StatusOK, body: []byte("ok")}

	res, err := Get(context.Background(), proxy, log.NewNopLogger(), testDS(), "/api/v1/alerts", "svc-login", "")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, res.Status)
	assert.Equal(t, []byte("ok"), res.Body)
	assert.Equal(t, 1, proxy.calls)
	assert.Equal(t, "ds1", proxy.gotUID)
	// The proxy strips /api/datasources/proxy/uid/<uid>/ to derive the upstream
	// path, so the config path must sit after that prefix.
	assert.Equal(t, "/api/datasources/proxy/uid/ds1/api/v1/alerts", proxy.gotPath)
}

func TestGet_TrimsLeadingSlashOnUpstreamPath(t *testing.T) {
	proxy := &fakeProxy{status: http.StatusOK, body: []byte("{}")}

	// Called once with a leading slash, once without — both must land on the
	// same proxied path (no double slash).
	_, err := Get(context.Background(), proxy, log.NewNopLogger(), testDS(), "config/v1/rules", "svc-login", "")
	require.NoError(t, err)
	assert.Equal(t, "/api/datasources/proxy/uid/ds1/config/v1/rules", proxy.gotPath)

	_, err = Get(context.Background(), proxy, log.NewNopLogger(), testDS(), "/config/v1/rules", "svc-login", "")
	require.NoError(t, err)
	assert.Equal(t, "/api/datasources/proxy/uid/ds1/config/v1/rules", proxy.gotPath)
}

func TestGet_SetsAcceptHeaderOnlyWhenNonEmpty(t *testing.T) {
	proxy := &fakeProxy{status: http.StatusOK, body: []byte("{}")}

	_, err := Get(context.Background(), proxy, log.NewNopLogger(), testDS(), "path", "login", "application/yaml")
	require.NoError(t, err)
	assert.Equal(t, "application/yaml", proxy.gotAccept)

	_, err = Get(context.Background(), proxy, log.NewNopLogger(), testDS(), "path", "login", "")
	require.NoError(t, err)
	assert.Equal(t, "", proxy.gotAccept)
}

func TestGet_ServiceIdentityUserCarriesOrgAndDatasourcePermissions(t *testing.T) {
	// The proxy's access check requires datasources:query/read on the
	// service-identity user — without these the real proxy would reject the
	// request before ever reaching the upstream datasource.
	proxy := &fakeProxy{status: http.StatusOK, body: []byte("{}")}

	_, err := Get(context.Background(), proxy, log.NewNopLogger(), testDS(), "path", "grafana_external_am_sync", "")
	require.NoError(t, err)
	assert.Equal(t, "grafana_external_am_sync", proxy.gotUser)
	assert.Equal(t, int64(7), proxy.gotOrgID)
	require.Contains(t, proxy.gotPerms, int64(7))
	assert.ElementsMatch(t, []string{datasources.ScopeAll}, proxy.gotPerms[7][datasources.ActionQuery])
	assert.ElementsMatch(t, []string{datasources.ScopeAll}, proxy.gotPerms[7][datasources.ActionRead])
}

func TestGet_PassesThroughNon2xxStatusAndBody(t *testing.T) {
	proxy := &fakeProxy{status: http.StatusInternalServerError, body: []byte("boom")}

	res, err := Get(context.Background(), proxy, log.NewNopLogger(), testDS(), "path", "login", "")
	require.NoError(t, err)
	assert.Equal(t, http.StatusInternalServerError, res.Status)
	assert.Equal(t, []byte("boom"), res.Body)
}

func TestGet_ProxyErrorPathDoesNotPanic(t *testing.T) {
	// The real proxy calls ReqContext.JsonApiErr on failures (datasource lookup,
	// access, plugin load), which logs via c.Logger; Get must supply a non-nil
	// logger or that call panics.
	proxy := &fakeProxy{apiErrStatus: http.StatusForbidden, apiErr: errors.New("access denied")}

	res, err := Get(context.Background(), proxy, log.NewNopLogger(), testDS(), "path", "login", "")
	require.NoError(t, err)
	assert.Equal(t, http.StatusForbidden, res.Status)
}
