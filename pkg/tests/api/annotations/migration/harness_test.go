package migration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/extensions/apiserver/tests/mt"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil/pgtest"
)

type migrationPhase string

const (
	phaseOff    migrationPhase = "off"
	phaseWrites migrationPhase = "proxy-writes"
	phaseAll    migrationPhase = "proxy-all"
)

var annotationGVR = annotationV0.AnnotationKind().GroupVersionResource()

// newAPI is the standalone annotation API server (postgres, --skip-auth) that the
// legacy proxy targets. It is started ONCE per test binary because
// RunInsecureServer -> StandaloneCobraCommand -> k8s SetupSignalHandler panics on
// a second call. A single top-level test owns it (via startNewAPI) and runs every
// scenario as a subtest, so its lifetime is tied to that test's *testing.T
type newAPI struct {
	url   string
	store *pgStore // direct access to the postgres store for assertions
}

// startNewAPI boots the standalone annotation API server on a throwaway postgres
// database. Both the database and server are bound to t, so they are torn down
// with the owning test. Skips when postgres is unavailable.
func startNewAPI(t *testing.T) *newAPI {
	t.Helper()
	dsn := pgtest.NewDatabase(t) // skips unless GRAFANA_TEST_DB=postgres

	runner := mt.RunInsecureServer(t, annotationGVR, []string{
		"--annotation.store-backend=postgres",
		fmt.Sprintf("--annotation.postgres-connection-string=%s", dsn),
		"--annotation.enable-legacy-id=true",
		fmt.Sprintf("--cert-dir=%s", t.TempDir()),
	})

	return &newAPI{
		url:   fmt.Sprintf("https://localhost:%d", runner.HttpPort),
		store: &pgStore{dsn: dsn},
	}
}

// harness wires the shared standalone API server together with a fresh legacy
// Grafana server whose migration proxy targets it, for one scenario.
type harness struct {
	addr     string // legacy Grafana listen address
	env      *server.TestEnv
	newStore *pgStore // direct access to the new API's postgres store
}

// newHarness starts a legacy Grafana server in the given migration phase, pointed
// at the shared new API, and truncates the new store so the scenario starts clean.
func newHarness(t *testing.T, api *newAPI, phase migrationPhase) *harness {
	t.Helper()
	api.store.truncate(t)

	opts := testinfra.GrafanaOpts{
		DisableAnonymous:           true,
		AnnotationMigrationPhase:   string(phase),
		AnnotationAPIServerURL:     api.url,
		AnnotationProxyStaticToken: "migration-test-token",
	}
	dir, cfgPath := testinfra.CreateGrafDir(t, opts)

	addr, env := testinfra.StartGrafanaEnv(t, dir, cfgPath)

	return &harness{
		addr:     addr,
		env:      env,
		newStore: api.store,
	}
}

// annotationReq is a minimal create payload for POST /api/annotations.
type annotationReq struct {
	Text         string
	Tags         []string
	DashboardUID string
	PanelID      int64
}

// createAnnotation POSTs to the legacy API and returns the assigned legacy ID.
// It uses a recent timestamp because the new API rejects times outside its
// retention/future window.
func (h *harness) createAnnotation(t *testing.T, req annotationReq) int64 {
	t.Helper()
	payload := map[string]any{
		"text": req.Text,
		"tags": req.Tags,
		"time": time.Now().UnixMilli(),
	}
	if req.DashboardUID != "" {
		payload["dashboardUID"] = req.DashboardUID
	}
	if req.PanelID != 0 {
		payload["panelId"] = req.PanelID
	}

	var out struct {
		ID      int64  `json:"id"`
		Message string `json:"message"`
	}
	h.doJSON(t, http.MethodPost, "/api/annotations", payload, http.StatusOK, &out)
	return out.ID
}

// getAnnotationByID GETs /api/annotations/:id and returns the DTO.
func (h *harness) getAnnotationByID(t *testing.T, id int64) *annotations.ItemDTO {
	t.Helper()
	var dto annotations.ItemDTO
	h.doJSON(t, http.MethodGet, fmt.Sprintf("/api/annotations/%d", id), nil, http.StatusOK, &dto)
	return &dto
}

// listAnnotations GETs /api/annotations with the given query string (without the
// leading "?") and returns the DTOs.
func (h *harness) listAnnotations(t *testing.T, query string) []*annotations.ItemDTO {
	t.Helper()
	path := "/api/annotations"
	if query != "" {
		path += "?" + query
	}
	var dtos []*annotations.ItemDTO
	h.doJSON(t, http.MethodGet, path, nil, http.StatusOK, &dtos)
	return dtos
}

// updateAnnotationText PUTs a new text/tags onto an annotation via the legacy API.
func (h *harness) updateAnnotationText(t *testing.T, id int64, text string, tags []string) {
	t.Helper()
	payload := map[string]any{"text": text, "tags": tags}
	h.doJSON(t, http.MethodPut, fmt.Sprintf("/api/annotations/%d", id), payload, http.StatusOK, nil)
}

// deleteAnnotation DELETEs an annotation via the legacy API.
func (h *harness) deleteAnnotation(t *testing.T, id int64) {
	t.Helper()
	h.doJSON(t, http.MethodDelete, fmt.Sprintf("/api/annotations/%d", id), nil, http.StatusOK, nil)
}

// seedLegacyOnly inserts a row straight into the legacy xorm store, bypassing the
// proxy, to emulate a record that predates the migration (or an alert
// annotation). Returns the assigned legacy ID.
func (h *harness) seedLegacyOnly(t *testing.T, item *annotations.Item) int64 {
	t.Helper()
	if item.OrgID == 0 {
		item.OrgID = 1
	}
	if item.Epoch == 0 {
		item.Epoch = time.Now().UnixMilli()
	}
	err := h.env.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Table("annotation").Insert(item)
		return err
	})
	require.NoError(t, err)
	require.NotZero(t, item.ID)
	return item.ID
}

// legacyCount returns the number of rows in the legacy xorm annotation table.
func (h *harness) legacyCount(t *testing.T) int {
	t.Helper()
	var count int64
	err := h.env.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.SQL("SELECT COUNT(*) FROM annotation").Get(&count)
		return err
	})
	require.NoError(t, err)
	return int(count)
}

// doJSON issues an authenticated (admin) request against the legacy API and,
// when out is non-nil, decodes a successful JSON response into it.
func (h *harness) doJSON(t *testing.T, method, path string, body any, wantStatus int, out any) {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		rdr = bytes.NewReader(b)
	}
	url := fmt.Sprintf("http://admin:admin@%s%s", h.addr, path)
	req, err := http.NewRequest(method, url, rdr)
	require.NoError(t, err)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req) // nolint:gosec
	require.NoError(t, err)
	raw, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	require.Equalf(t, wantStatus, resp.StatusCode, "%s %s -> %d: %s", method, path, resp.StatusCode, raw)
	if out != nil {
		require.NoError(t, json.Unmarshal(raw, out), "decode %s %s response: %s", method, path, raw)
	}
}

// pgStore queries the new API's postgres store directly for assertions.
type pgStore struct {
	dsn string
}

// truncate empties the new store between tests. TRUNCATE on the partitioned
// parent cascades to all week partitions.
func (s *pgStore) truncate(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, s.dsn)
	require.NoError(t, err)
	defer func() { _ = conn.Close(ctx) }()

	_, err = conn.Exec(ctx, "TRUNCATE TABLE annotations")
	require.NoError(t, err)
}

// countByLegacyID counts rows in the new store carrying the given legacy ID.
func (s *pgStore) countByLegacyID(t *testing.T, legacyID int64) int {
	t.Helper()
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, s.dsn)
	require.NoError(t, err)
	defer func() { _ = conn.Close(ctx) }()

	var count int
	err = conn.QueryRow(ctx, "SELECT COUNT(*) FROM annotations WHERE legacy_id = $1", legacyID).Scan(&count)
	require.NoError(t, err)
	return count
}
