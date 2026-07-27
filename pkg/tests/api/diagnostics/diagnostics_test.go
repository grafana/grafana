//go:build integration

package diagnostics

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// These tests exercise the on-prem, admin-only, flag-gated on-demand diagnostics endpoints
// end-to-end against a started Grafana:
//
//   - POST /api/ds/diagnostics                        (single-panel, synchronous)
//   - POST /api/ds/dashboard-diagnostics              (whole-dashboard, async create)
//   - GET  /api/ds/dashboard-diagnostics/:uid         (async status)
//   - GET  /api/ds/dashboard-diagnostics/:uid/download(async archive download)
//
// Query results are produced in-process by the core grafana-testdata-datasource plugin, using its
// random_walk (success) and random_walk_with_error (per-refID error) scenarios. testdata makes no
// outbound HTTP calls, so no traffic.har is ever captured here (see the note on the single-panel
// error case below).
//
// The grafana.onDemandDiagnostics flag is evaluated via OpenFeature, whose provider is a
// process-global singleton reset by each testinfra.StartGrafanaEnv (which calls
// InitOpenFeatureWithCfg from the instance's [feature_toggles] config). To avoid one instance's
// flag state leaking into another, the flag-enabled and flag-disabled scenarios live in SEPARATE
// top-level tests so that only one server (hence one global provider state) is alive at a time; Go
// runs top-level tests sequentially and each StartGrafanaEnv re-initializes the provider.

const (
	testDataSourceType = datasources.DS_TESTDATA // "grafana-testdata-datasource"
	adminUser          = "admin"
	adminPass          = "admin"
)

// TestIntegrationDiagnosticsDisabled verifies the single-panel endpoint is 404 when the
// grafana.onDemandDiagnostics flag is off, even for a server admin with an otherwise valid request.
// The route is still registered (on-prem, StackID==""), so this exercises the handler's flag gate.
func TestIntegrationDiagnosticsDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		// flag intentionally NOT enabled
	})
	addr, testEnv := testinfra.StartGrafanaEnv(t, dir, cfgPath)
	ctx := context.Background()

	dsUID := addTestDataSource(t, ctx, testEnv, "diag-disabled-ds")
	body := singlePanelBody(dsUID, "random_walk")

	status, respBody, _ := doJSON(t, http.MethodPost, diagURL(addr, adminUser, adminPass, "ds/diagnostics"), body)
	assert.Equal(t, http.StatusNotFound, status, "flag off must gate the endpoint: %s", string(respBody))
}

// TestIntegrationDiagnosticsSinglePanel covers POST /api/ds/diagnostics with the flag ON.
func TestIntegrationDiagnosticsSinglePanel(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{featuremgmt.FlagGrafanaOnDemandDiagnostics},
	})
	addr, testEnv := testinfra.StartGrafanaEnv(t, dir, cfgPath)
	ctx := context.Background()

	dsUID := addTestDataSource(t, ctx, testEnv, "diag-single-ds")

	t.Run("success returns a .tar.gz bundle with querydata.json", func(t *testing.T) {
		body := singlePanelBody(dsUID, "random_walk")

		status, respBody, header := doJSON(t, http.MethodPost, diagURL(addr, adminUser, adminPass, "ds/diagnostics"), body)
		require.Equal(t, http.StatusOK, status, "body: %s", string(respBody))

		assert.Equal(t, "application/tar+gzip", header.Get("Content-Type"))
		cd := header.Get("Content-Disposition")
		assert.True(t, strings.HasPrefix(cd, `attachment; filename="diagnostics-`), "Content-Disposition: %q", cd)
		assert.True(t, strings.HasSuffix(cd, `.tar.gz"`), "Content-Disposition: %q", cd)

		members := readTarGz(t, respBody)

		// querydata.json must be present and record the submitted request + the per-refID result.
		qdRaw, ok := members["querydata.json"]
		require.True(t, ok, "bundle members: %v", memberNames(members))
		var artifact queryDataArtifact
		require.NoError(t, json.Unmarshal(qdRaw, &artifact))
		assert.Equal(t, 1, artifact.Version)
		assert.Contains(t, string(artifact.Request), "random_walk", "request JSON should carry the submitted scenario")
		require.NotEmpty(t, artifact.Response, "response should be recorded")
		assert.Contains(t, string(artifact.Response), `"A"`, "response should carry the refID A result")

		// The client-supplied panel/dashboard JSON is echoed into the bundle.
		assert.Contains(t, memberNames(members), "panel.json")
		assert.Contains(t, memberNames(members), "dashboard.json")

		// testdata makes no HTTP calls, so nothing is captured on the wire: no traffic.har here.
		assert.NotContains(t, memberNames(members), "traffic.har")
	})

	t.Run("non-admin is forbidden", func(t *testing.T) {
		login := "diag-viewer"
		pass := "viewer-pass"
		tests.CreateUser(t, testEnv.SQLStore, testEnv.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleViewer),
			Password:       user.Password(pass),
			Login:          login,
			OrgID:          1,
		})

		body := singlePanelBody(dsUID, "random_walk")
		status, respBody, _ := doJSON(t, http.MethodPost, diagURL(addr, login, pass, "ds/diagnostics"), body)
		// reqGrafanaAdmin runs before the handler, so a non-server-admin is rejected regardless of the flag.
		assert.Equal(t, http.StatusForbidden, status, "body: %s", string(respBody))
	})

	t.Run("empty queries is a bad request", func(t *testing.T) {
		body := []byte(`{"from":"now-1h","to":"now","queries":[]}`)
		status, respBody, _ := doJSON(t, http.MethodPost, diagURL(addr, adminUser, adminPass, "ds/diagnostics"), body)
		assert.Equal(t, http.StatusBadRequest, status, "body: %s", string(respBody))
	})

	// A datasource error on the single-panel path: because testdata never touches the wire, no HAR is
	// captured, so the handler surfaces the failure directly (per-refID failure => 400) instead of a
	// 200 bundle. Recording a datasource error INSIDE a bundle is covered by the dashboard flow below,
	// which builds the archive unconditionally. See NOTE in the report.
	t.Run("datasource error without HTTP capture surfaces a 400", func(t *testing.T) {
		body := singlePanelBody(dsUID, "random_walk_with_error")
		status, respBody, _ := doJSON(t, http.MethodPost, diagURL(addr, adminUser, adminPass, "ds/diagnostics"), body)
		assert.Equal(t, http.StatusBadRequest, status, "body: %s", string(respBody))
	})
}

// TestIntegrationDiagnosticsDashboard covers the async whole-dashboard flow with the flag ON:
// create -> poll status -> download, including a per-panel error recorded in the archive.
func TestIntegrationDiagnosticsDashboard(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{featuremgmt.FlagGrafanaOnDemandDiagnostics},
	})
	addr, testEnv := testinfra.StartGrafanaEnv(t, dir, cfgPath)
	ctx := context.Background()

	dsUID := addTestDataSource(t, ctx, testEnv, "diag-dash-ds")

	// Two data panels: one succeeds (random_walk), one fails per-refID (random_walk_with_error).
	reqBody := fmt.Sprintf(`{
		"dashboard": {"title":"Diag Dashboard","uid":"diag-dash-1","panels":[]},
		"panels": [
			{
				"id": 1,
				"title": "Success Panel",
				"panel": {"id":1,"title":"Success Panel","type":"timeseries"},
				"from": "now-1h",
				"to": "now",
				"queries": [{"refId":"A","scenarioId":"random_walk","datasource":{"uid":%q,"type":%q}}]
			},
			{
				"id": 2,
				"title": "Error Panel",
				"panel": {"id":2,"title":"Error Panel","type":"timeseries"},
				"from": "now-1h",
				"to": "now",
				"queries": [{"refId":"A","scenarioId":"random_walk_with_error","datasource":{"uid":%q,"type":%q}}]
			}
		]
	}`, dsUID, testDataSourceType, dsUID, testDataSourceType)

	// Create: returns 202 with a job UID.
	status, respBody, _ := doJSON(t, http.MethodPost, diagURL(addr, adminUser, adminPass, "ds/dashboard-diagnostics"), []byte(reqBody))
	require.Equal(t, http.StatusAccepted, status, "body: %s", string(respBody))

	var created struct {
		UID   string `json:"uid"`
		State string `json:"state"`
	}
	require.NoError(t, json.Unmarshal(respBody, &created))
	require.NotEmpty(t, created.UID)
	assert.Equal(t, "pending", created.State)

	// Unknown UID => 404 (also confirms per-identity scoping does not leak jobs).
	unknownStatus, _, _ := doJSON(t, http.MethodGet, diagURL(addr, adminUser, adminPass, "ds/dashboard-diagnostics/does-not-exist"), nil)
	assert.Equal(t, http.StatusNotFound, unknownStatus)

	// Poll status until the job reaches a terminal state.
	statusURL := diagURL(addr, adminUser, adminPass, "ds/dashboard-diagnostics/"+created.UID)
	var finalState string
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		st, b, _ := doJSON(t, http.MethodGet, statusURL, nil)
		require.Equal(t, http.StatusOK, st, "status body: %s", string(b))
		var snap struct {
			State       string `json:"state"`
			PanelsTotal int    `json:"panelsTotal"`
			PanelsDone  int    `json:"panelsDone"`
		}
		require.NoError(t, json.Unmarshal(b, &snap))
		assert.Equal(t, 2, snap.PanelsTotal)
		if snap.State == "complete" || snap.State == "error" {
			finalState = snap.State
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	require.Equal(t, "complete", finalState, "job did not complete in time")

	// Download the archive.
	dlStatus, dlBody, dlHeader := doJSON(t, http.MethodGet, diagURL(addr, adminUser, adminPass, "ds/dashboard-diagnostics/"+created.UID+"/download"), nil)
	require.Equal(t, http.StatusOK, dlStatus, "download body: %s", string(dlBody))
	assert.Equal(t, "application/tar+gzip", dlHeader.Get("Content-Type"))
	assert.True(t, strings.HasPrefix(dlHeader.Get("Content-Disposition"), `attachment; filename="dashboard-diagnostics-`))

	members := readTarGz(t, dlBody)
	names := memberNames(members)

	// Shared artifacts.
	require.Contains(t, names, "dashboard.json")
	require.Contains(t, names, "manifest.json")

	// Per-panel directories.
	successDir := findDir(t, names, "panels/1-")
	errorDir := findDir(t, names, "panels/2-")
	assert.Contains(t, names, successDir+"/panel.json")
	assert.Contains(t, names, successDir+"/querydata.json")
	// The failing panel records its error both as a file and in the manifest.
	assert.Contains(t, names, errorDir+"/query-error.txt")

	// Manifest: 2 panels total, exactly one ran successfully, and panel 2 carries an error string.
	var manifest struct {
		PanelsTotal int `json:"panelsTotal"`
		PanelsRun   int `json:"panelsRun"`
		Panels      []struct {
			ID    int64  `json:"id"`
			Dir   string `json:"dir"`
			Error string `json:"error"`
		} `json:"panels"`
	}
	require.NoError(t, json.Unmarshal(members["manifest.json"], &manifest))
	assert.Equal(t, 2, manifest.PanelsTotal)
	assert.Equal(t, 1, manifest.PanelsRun, "only the success panel should count as run")

	byID := map[int64]string{}
	for _, p := range manifest.Panels {
		byID[p.ID] = p.Error
	}
	assert.Empty(t, byID[1], "success panel should have no error")
	assert.NotEmpty(t, byID[2], "error panel should record its datasource error")
}

// ---- helpers ------------------------------------------------------------------------------------

// queryDataArtifact mirrors the shape written to querydata.json (the fields this test asserts on).
type queryDataArtifact struct {
	Version  int             `json:"version"`
	Request  json.RawMessage `json:"request"`
	Response json.RawMessage `json:"response"`
}

func addTestDataSource(t *testing.T, ctx context.Context, testEnv *server.TestEnv, uid string) string {
	t.Helper()
	_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		OrgID:  1,
		Access: datasources.DS_ACCESS_PROXY,
		Name:   uid,
		Type:   testDataSourceType,
		UID:    uid,
	})
	require.NoError(t, err)
	return uid
}

// singlePanelBody builds a POST /api/ds/diagnostics body: a MetricRequest plus the client-supplied
// panel/dashboard JSON the endpoint echoes into the bundle.
func singlePanelBody(dsUID, scenario string) []byte {
	return []byte(fmt.Sprintf(`{
		"from": "now-1h",
		"to": "now",
		"queries": [{"refId":"A","scenarioId":%q,"datasource":{"uid":%q,"type":%q}}],
		"panel": {"id":1,"title":"Diag Panel","type":"timeseries"},
		"dashboard": {"title":"Diag Dashboard","uid":"diag-1"}
	}`, scenario, dsUID, testDataSourceType))
}

func diagURL(addr, user, pass, path string) string {
	return fmt.Sprintf("http://%s:%s@%s/api/%s", user, pass, addr, path)
}

// doJSON performs an HTTP request with an optional JSON body and returns status, raw body, headers.
func doJSON(t *testing.T, method, url string, body []byte) (int, []byte, http.Header) {
	t.Helper()
	var r io.Reader
	if body != nil {
		r = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, url, r)
	require.NoError(t, err)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req) // nolint:gosec
	require.NoError(t, err)
	defer func() { require.NoError(t, resp.Body.Close()) }()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, b, resp.Header
}

// readTarGz unpacks a .tar.gz response body into a name->contents map.
func readTarGz(t *testing.T, data []byte) map[string][]byte {
	t.Helper()
	gz, err := gzip.NewReader(bytes.NewReader(data))
	require.NoError(t, err, "response body is not valid gzip")
	defer func() { require.NoError(t, gz.Close()) }()

	members := map[string][]byte{}
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		require.NoError(t, err)
		contents, err := io.ReadAll(tr)
		require.NoError(t, err)
		members[hdr.Name] = contents
	}
	return members
}

func memberNames(members map[string][]byte) []string {
	names := make([]string, 0, len(members))
	for name := range members {
		names = append(names, name)
	}
	return names
}

// findDir returns the first archive member name that begins with prefix and, from it, the directory
// portion (the panels/<id>-<slug> path). Fails the test if no member matches.
func findDir(t *testing.T, names []string, prefix string) string {
	t.Helper()
	for _, n := range names {
		if strings.HasPrefix(n, prefix) {
			if idx := strings.LastIndex(n, "/"); idx > 0 {
				return n[:idx]
			}
		}
	}
	t.Fatalf("no archive member with prefix %q in %v", prefix, names)
	return ""
}
