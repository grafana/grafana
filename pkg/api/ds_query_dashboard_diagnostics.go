package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/diagnostics"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// maxDashboardDiagnosticsPanels bounds how many panels a single request will execute, so a huge
// dashboard can't spawn an unbounded amount of query work.
const maxDashboardDiagnosticsPanels = 50

// dashboardDiagnosticsTTL is how long a generated bundle is retained for download.
const dashboardDiagnosticsTTL = 30 * time.Minute

// dashboardDiagnosticsTimeout caps a background generation run so a slow/large dashboard can't keep
// a goroutine (and its captured data) alive indefinitely.
const dashboardDiagnosticsTimeout = 5 * time.Minute

// diagnosticsEnabled reports whether the grafana.onDemandDiagnostics feature flag is on for the
// current request. It reuses the shared OpenFeature client (see ds_query_diagnostics.go).
func diagnosticsEnabled(ctx context.Context) bool {
	return diagnosticsFeatureClient.Boolean(ctx, featuremgmt.FlagGrafanaOnDemandDiagnostics, false, openfeature.TransactionContext(ctx))
}

// dashboardDiagnosticsRequest is posted by the dashboard-level "Download diagnostics" action. The
// client resolves each data panel's queries (template variables applied) and sends them with the
// panel definition, so the backend can run them without a dashboard-service lookup.
type dashboardDiagnosticsRequest struct {
	Dashboard json.RawMessage        `json:"dashboard"`
	Panels    []panelDiagnosticsSpec `json:"panels"`
}

type panelDiagnosticsSpec struct {
	dtos.MetricRequest                 // from/to/queries for this panel
	ID                 int64           `json:"id"`
	Title              string          `json:"title"`
	Panel              json.RawMessage `json:"panel"`
}

// ---- async job store (in-memory; mirrors the support-bundle create/pending/complete model) -------
//
// NOTE: in-memory means jobs don't survive a restart and aren't shared across HA replicas. A
// production version would persist to a store (as the support bundle does via kvstore).

type diagnosticsJobState string

const (
	jobPending  diagnosticsJobState = "pending"
	jobComplete diagnosticsJobState = "complete"
	jobError    diagnosticsJobState = "error"
)

type diagnosticsJob struct {
	UID         string
	State       diagnosticsJobState
	CreatedAt   time.Time
	ExpiresAt   time.Time
	PanelsTotal int
	PanelsDone  int
	Err         string
	archive     []byte

	// createdByOrgID/createdByUID scope status/download to the identity that started the run. Jobs
	// may hold verbatim captured HTTP traffic (see the harcapture package doc), so this is enforced
	// even though the routes themselves are already gated admin-only.
	createdByOrgID int64
	createdByUID   string
}

// jobOwnedBy reports whether requester is the identity that created j.
func jobOwnedBy(j *diagnosticsJob, requester identity.Requester) bool {
	return j.createdByOrgID == requester.GetOrgID() && j.createdByUID == requester.GetUID()
}

type diagnosticsJobSnapshot struct {
	UID         string
	State       diagnosticsJobState
	PanelsTotal int
	PanelsDone  int
	Err         string
	CreatedAt   time.Time
	ExpiresAt   time.Time
}

type diagnosticsJobStore struct {
	mu   sync.RWMutex
	jobs map[string]*diagnosticsJob
}

// dashboardDiagnosticsJobs is the process-wide job store. Package-level so the endpoint methods on
// *HTTPServer can share it without new wire/DI wiring for this experimental feature.
var dashboardDiagnosticsJobs = &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}

func (s *diagnosticsJobStore) create(total int, creator identity.Requester) *diagnosticsJob {
	now := time.Now()
	j := &diagnosticsJob{
		UID:            util.GenerateShortUID(),
		State:          jobPending,
		CreatedAt:      now,
		ExpiresAt:      now.Add(dashboardDiagnosticsTTL),
		PanelsTotal:    total,
		createdByOrgID: creator.GetOrgID(),
		createdByUID:   creator.GetUID(),
	}
	s.mu.Lock()
	s.pruneExpiredLocked(now)
	s.jobs[j.UID] = j
	s.mu.Unlock()
	return j
}

// pruneExpiredLocked removes expired jobs (and their in-memory archives). Callers must hold s.mu
// for writing. Called from every store access, not just create, so an idle feature (no new jobs,
// but the odd status poll) still reclaims memory instead of holding onto expired archives until
// the next generation run.
func (s *diagnosticsJobStore) pruneExpiredLocked(now time.Time) {
	for uid, existing := range s.jobs {
		if now.After(existing.ExpiresAt) {
			delete(s.jobs, uid)
		}
	}
}

func (s *diagnosticsJobStore) setProgress(uid string, done int) {
	s.mu.Lock()
	if j := s.jobs[uid]; j != nil {
		j.PanelsDone = done
	}
	s.mu.Unlock()
}

func (s *diagnosticsJobStore) complete(uid string, archive []byte) {
	s.mu.Lock()
	if j := s.jobs[uid]; j != nil {
		j.State = jobComplete
		j.archive = archive
	}
	s.mu.Unlock()
}

func (s *diagnosticsJobStore) fail(uid string, err error) {
	s.mu.Lock()
	if j := s.jobs[uid]; j != nil {
		j.State = jobError
		j.Err = err.Error()
	}
	s.mu.Unlock()
}

// snapshot returns uid's status, scoped to requester: a job that exists but belongs to a different
// identity is reported exactly like an unknown UID, so this can't be used to probe for other users'
// job IDs.
func (s *diagnosticsJobStore) snapshot(uid string, requester identity.Requester) (diagnosticsJobSnapshot, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneExpiredLocked(time.Now())
	j := s.jobs[uid]
	if j == nil || !jobOwnedBy(j, requester) {
		return diagnosticsJobSnapshot{}, false
	}
	return diagnosticsJobSnapshot{j.UID, j.State, j.PanelsTotal, j.PanelsDone, j.Err, j.CreatedAt, j.ExpiresAt}, true
}

// archiveOf returns uid's archive, scoped to requester the same way snapshot is.
func (s *diagnosticsJobStore) archiveOf(uid string, requester identity.Requester) (archive []byte, state diagnosticsJobState, found bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneExpiredLocked(time.Now())
	j := s.jobs[uid]
	if j == nil || !jobOwnedBy(j, requester) {
		return nil, "", false
	}
	return j.archive, j.State, true
}

// ---- handlers -----------------------------------------------------------------------------------

// QueryDashboardDiagnostics starts an asynchronous dashboard-diagnostics generation and returns a
// job UID immediately (202). Generation runs in a background goroutine with its own timeout so a
// large/slow dashboard can't block or time out the HTTP request. Poll the status endpoint, then
// download when complete. Gated on the grafana.onDemandDiagnostics flag; server-admin only (route).
func (hs *HTTPServer) QueryDashboardDiagnostics(c *contextmodel.ReqContext) response.Response {
	if !diagnosticsEnabled(c.Req.Context()) {
		return response.Error(http.StatusNotFound, "on-demand diagnostics is not enabled", nil)
	}

	reqDTO := dashboardDiagnosticsRequest{}
	if err := web.Bind(c.Req, &reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if len(reqDTO.Panels) == 0 {
		return response.Error(http.StatusBadRequest, "at least one panel is required", nil)
	}

	jobTotal := len(reqDTO.Panels)
	if jobTotal > maxDashboardDiagnosticsPanels {
		jobTotal = maxDashboardDiagnosticsPanels // status polling only ever sees the capped run
	}
	job := dashboardDiagnosticsJobs.create(jobTotal, c.SignedInUser)

	// Snapshot the identity + cache flag; the goroutine must not touch the request or its context
	// (both are tied to the HTTP request's lifetime, which ends when we return 202).
	user := c.SignedInUser
	skipDSCache := c.SkipDSCache

	// detachedCtx carries its own cloned *http.Request (see contexthandler.CopyWithReqContext), so
	// it stays safe to use after this handler returns. Force SkipQueryCache on it so a cache-hit
	// query still goes to the wire under capture -- otherwise HAR capture runs on nothing and
	// traffic.har is silently empty (same requirement as QueryDiagnostics in ds_query_diagnostics.go
	// for the single-panel path, where c.SkipQueryCache is set directly on the request's ReqContext).
	detachedCtx := contexthandler.CopyWithReqContext(c.Req.Context())
	if reqCtx := contexthandler.FromContext(detachedCtx); reqCtx != nil {
		reqCtx.SkipQueryCache = true
	}

	go func(uid string, user identity.Requester, skipDSCache bool, req dashboardDiagnosticsRequest) {
		ctx, cancel := context.WithTimeout(detachedCtx, dashboardDiagnosticsTimeout)
		defer cancel()
		defer func() {
			if r := recover(); r != nil {
				dashboardDiagnosticsJobs.fail(uid, fmt.Errorf("dashboard diagnostics panic: %v", r))
			}
		}()

		archive, err := hs.buildDashboardDiagnosticsArchive(ctx, user, skipDSCache, req, uid)
		if err != nil {
			dashboardDiagnosticsJobs.fail(uid, err)
			return
		}
		dashboardDiagnosticsJobs.complete(uid, archive)
	}(job.UID, user, skipDSCache, reqDTO)

	return response.JSON(http.StatusAccepted, map[string]any{"uid": job.UID, "state": jobPending})
}

// GetDashboardDiagnosticsStatus reports a generation job's progress/state.
func (hs *HTTPServer) GetDashboardDiagnosticsStatus(c *contextmodel.ReqContext) response.Response {
	if !diagnosticsEnabled(c.Req.Context()) {
		return response.Error(http.StatusNotFound, "on-demand diagnostics is not enabled", nil)
	}
	uid := web.Params(c.Req)[":uid"]
	snap, ok := dashboardDiagnosticsJobs.snapshot(uid, c.SignedInUser)
	if !ok {
		return response.Error(http.StatusNotFound, "diagnostics job not found (it may have expired)", nil)
	}
	return response.JSON(http.StatusOK, map[string]any{
		"uid":         snap.UID,
		"state":       snap.State,
		"panelsTotal": snap.PanelsTotal,
		"panelsDone":  snap.PanelsDone,
		"error":       snap.Err,
		"createdAt":   snap.CreatedAt.UTC().Format(time.RFC3339),
		"expiresAt":   snap.ExpiresAt.UTC().Format(time.RFC3339),
	})
}

// DownloadDashboardDiagnostics serves the generated .tar.gz once the job is complete.
func (hs *HTTPServer) DownloadDashboardDiagnostics(c *contextmodel.ReqContext) response.Response {
	if !diagnosticsEnabled(c.Req.Context()) {
		return response.Error(http.StatusNotFound, "on-demand diagnostics is not enabled", nil)
	}
	uid := web.Params(c.Req)[":uid"]
	archive, state, ok := dashboardDiagnosticsJobs.archiveOf(uid, c.SignedInUser)
	if !ok {
		return response.Error(http.StatusNotFound, "diagnostics job not found (it may have expired)", nil)
	}
	if state != jobComplete {
		return response.Error(http.StatusConflict, fmt.Sprintf("diagnostics not ready (state: %s)", state), nil)
	}

	filename := fmt.Sprintf("dashboard-diagnostics-%s.tar.gz", time.Now().UTC().Format("20060102-150405"))
	header := http.Header{}
	header.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	header.Set("Content-Type", "application/tar+gzip")
	return response.CreateNormalResponse(header, archive, http.StatusOK)
}

// ---- generation ---------------------------------------------------------------------------------

// buildDashboardDiagnosticsArchive runs each panel's queries with independent HAR capture, updating
// job progress as panels complete, then delegates archive assembly to the diagnostics service. A
// non-data panel (no queries) is recorded as skipped rather than run.
func (hs *HTTPServer) buildDashboardDiagnosticsArchive(ctx context.Context, user identity.Requester, skipDSCache bool, reqDTO dashboardDiagnosticsRequest, jobUID string) ([]byte, error) {
	specs := reqDTO.Panels
	truncated := false
	if len(specs) > maxDashboardDiagnosticsPanels {
		specs = specs[:maxDashboardDiagnosticsPanels]
		truncated = true
	}

	panels := make([]diagnostics.DashboardPanel, 0, len(specs))
	for i, p := range specs {
		if err := ctx.Err(); err != nil { // respect the generation timeout/cancel
			return nil, err
		}

		panel := diagnostics.DashboardPanel{
			ID:          p.ID,
			Title:       p.Title,
			PanelJSON:   p.Panel,
			Datasources: panelDatasourceUIDs(p.MetricRequest),
		}

		if len(p.Queries) == 0 {
			panel.Skipped = "no queries (non-data panel)"
			panels = append(panels, panel)
			dashboardDiagnosticsJobs.setProgress(jobUID, i+1)
			continue
		}

		pctx, harBuffer := harcapture.WithCapture(ctx) // capture each panel independently
		_, err := hs.queryDataService.QueryData(pctx, user, skipDSCache, p.MetricRequest)
		panel.HARBuffer = harBuffer
		panel.QueryErr = err

		panels = append(panels, panel)
		dashboardDiagnosticsJobs.setProgress(jobUID, i+1)
	}

	return diagnostics.NewBundler().BuildDashboard(reqDTO.Dashboard, panels, len(reqDTO.Panels), truncated)
}

// panelDatasourceUIDs returns the unique datasource UIDs referenced by a panel's queries.
func panelDatasourceUIDs(req dtos.MetricRequest) []string {
	seen := map[string]bool{}
	uids := make([]string, 0, len(req.Queries))
	for _, q := range req.Queries {
		if q == nil {
			continue
		}
		uid := q.Get("datasource").Get("uid").MustString()
		if uid != "" && !seen[uid] {
			seen[uid] = true
			uids = append(uids, uid)
		}
	}
	return uids
}
