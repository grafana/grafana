package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
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

// NOTE (MVP scope): resource limits are intentionally deferred to a follow-up PR (tracked) to keep
// this experimental feature small: no panel-count cap, no per-run timeout, and no per-body/
// per-request byte caps. See the "dashboard-level limits" follow-up. The in-memory job store is
// still bounded (retention TTL + max-entries + in-flight caps below) so it can't grow without limit;
// that is a correctness guard against unbounded memory, not one of the deferred resource limits.

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
	finishedAt  time.Time // when the job reached a terminal state; retention is measured from here
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

// jobOwnedBy reports whether requester is the identity that created j. An empty UID on either side
// never matches: admin-gated callers always carry a real UID, so this guards against a fail-open
// where two identities with an empty UID in the same org would collide into one "owner" and could
// read each other's job (which may hold verbatim captured HTTP traffic).
func jobOwnedBy(j *diagnosticsJob, requester identity.Requester) bool {
	uid := requester.GetUID()
	if uid == "" || j.createdByUID == "" {
		return false
	}
	return j.createdByOrgID == requester.GetOrgID() && j.createdByUID == uid
}

type diagnosticsJobSnapshot struct {
	UID         string
	State       diagnosticsJobState
	PanelsTotal int
	PanelsDone  int
	Err         string
	CreatedAt   time.Time
}

type diagnosticsJobStore struct {
	mu   sync.RWMutex
	jobs map[string]*diagnosticsJob
}

// dashboardDiagnosticsJobs is the process-wide job store. Package-level so the endpoint methods on
// *HTTPServer can share it without new wire/DI wiring for this experimental feature.
var dashboardDiagnosticsJobs = &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}

const (
	// diagnosticsJobRetention bounds how long a job -- including its archive bytes -- is kept, so the
	// process-wide store doesn't grow forever on a long-running server. Pruned opportunistically when
	// a job is created and when one goes terminal (no background sweeper for this experimental
	// feature); finer-grained retention is part of the limits follow-up.
	diagnosticsJobRetention = time.Hour
	// diagnosticsJobMaxEntries is a hard cap on retained jobs so a burst of creations within the
	// retention window still can't grow the store without bound. The oldest jobs by completion time
	// are evicted first.
	diagnosticsJobMaxEntries = 100
	// diagnosticsMaxInFlightJobs caps concurrently generating (pending) jobs. Pending jobs are never
	// pruned -- their background goroutine is still writing to them -- so without this cap an admin
	// repeatedly POSTing large dashboards could spawn unbounded long-lived goroutines, each holding
	// capture buffers and query responses. create() rejects further starts until one finishes.
	diagnosticsMaxInFlightJobs = 4
)

// create registers a new pending job for total panels, owned by creator. It returns ok=false without
// creating anything when diagnosticsMaxInFlightJobs generations are already pending: pending jobs are
// exempt from retention/max-entries pruning (their goroutine is still writing), so this in-flight cap
// is the only bound on concurrent generation work.
func (s *diagnosticsJobStore) create(total int, creator identity.Requester) (job *diagnosticsJob, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	inFlight := 0
	for _, j := range s.jobs {
		if j.State == jobPending {
			inFlight++
		}
	}
	if inFlight >= diagnosticsMaxInFlightJobs {
		return nil, false
	}

	j := &diagnosticsJob{
		UID:            util.GenerateShortUID(),
		State:          jobPending,
		CreatedAt:      time.Now(),
		PanelsTotal:    total,
		createdByOrgID: creator.GetOrgID(),
		createdByUID:   creator.GetUID(),
	}
	s.jobs[j.UID] = j
	s.pruneLocked(j.CreatedAt) // after insert, so the cap is exact (this job is newest, never evicted)
	return j, true
}

// pruneLocked drops terminal jobs past the retention TTL, then evicts the oldest terminal jobs
// beyond the max-entries cap. Caller must hold s.mu. This is what keeps the in-memory store bounded.
//
// A still-pending job is never evicted: its background goroutine is still writing to it, so dropping
// it would orphan the run -- complete/fail would no-op and status/download would 404 after expensive
// generation. Only complete/error jobs are eligible here, so the store is bounded by (finished jobs
// up to the cap) plus at most diagnosticsMaxInFlightJobs runs in flight (capped in create).
//
// Retention is measured from finishedAt (not CreatedAt): a run that takes longer than the retention
// window would otherwise be prunable the instant it completes, 404-ing a download for a job that just
// finished. finishedAt is set exactly when the job goes terminal, so a fresh result always gets the
// full window.
func (s *diagnosticsJobStore) pruneLocked(now time.Time) {
	terminal := make([]string, 0, len(s.jobs))
	for uid, j := range s.jobs {
		if j.State == jobPending {
			continue
		}
		if now.Sub(j.finishedAt) > diagnosticsJobRetention {
			delete(s.jobs, uid)
			continue
		}
		terminal = append(terminal, uid)
	}
	if len(terminal) <= diagnosticsJobMaxEntries {
		return
	}
	// Evict by finishedAt, not CreatedAt: retention is measured from finishedAt, so a slow run with an
	// old CreatedAt but a just-set finishedAt is genuinely the freshest result and must outlive older
	// completions -- ordering by CreatedAt would evict it first and 404 an immediate download. Every
	// job here is terminal, so finishedAt is always set.
	sort.Slice(terminal, func(a, b int) bool {
		return s.jobs[terminal[a]].finishedAt.Before(s.jobs[terminal[b]].finishedAt)
	})
	for _, uid := range terminal[:len(terminal)-diagnosticsJobMaxEntries] {
		delete(s.jobs, uid)
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
		j.finishedAt = time.Now()
		// Prune here too, not only on create: a job going terminal is when its archive bytes
		// materialize and when it starts counting against the cap, and there may be no further
		// create() to trigger a sweep. Without this, finished jobs accumulate unbounded once creates
		// stop, and the cap can be exceeded after a burst of runs all finish.
		s.pruneLocked(j.finishedAt)
	}
	s.mu.Unlock()
}

func (s *diagnosticsJobStore) fail(uid string, err error) {
	s.mu.Lock()
	if j := s.jobs[uid]; j != nil {
		j.State = jobError
		j.Err = err.Error()
		j.finishedAt = time.Now()
		s.pruneLocked(j.finishedAt)
	}
	s.mu.Unlock()
}

// snapshot returns uid's status, scoped to requester: a job that exists but belongs to a different
// identity is reported exactly like an unknown UID, so this can't be used to probe for other users'
// job IDs.
func (s *diagnosticsJobStore) snapshot(uid string, requester identity.Requester) (diagnosticsJobSnapshot, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	j := s.jobs[uid]
	if j == nil || !jobOwnedBy(j, requester) {
		return diagnosticsJobSnapshot{}, false
	}
	return diagnosticsJobSnapshot{j.UID, j.State, j.PanelsTotal, j.PanelsDone, j.Err, j.CreatedAt}, true
}

// archiveOf returns uid's archive, scoped to requester the same way snapshot is.
func (s *diagnosticsJobStore) archiveOf(uid string, requester identity.Requester) (archive []byte, state diagnosticsJobState, found bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	j := s.jobs[uid]
	if j == nil || !jobOwnedBy(j, requester) {
		return nil, "", false
	}
	return j.archive, j.State, true
}

// ---- handlers -----------------------------------------------------------------------------------

// QueryDashboardDiagnostics starts an asynchronous dashboard-diagnostics generation and returns a
// job UID immediately (202). Generation runs in a detached background goroutine, so a large/slow
// dashboard can't block or time out the HTTP request. There is no per-run timeout yet (MVP scope,
// see the NOTE above). Poll the status endpoint, then download when complete. Gated on the
// grafana.onDemandDiagnostics flag; server-admin only (route).
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

	job, ok := dashboardDiagnosticsJobs.create(len(reqDTO.Panels), c.SignedInUser)
	if !ok {
		return response.Error(http.StatusTooManyRequests, "too many dashboard diagnostics jobs are already in progress; try again once one finishes", nil)
	}
	if hs.diagnosticsMetrics != nil {
		hs.diagnosticsMetrics.RecordStarted(c.Req.Context(), diagnostics.ScopeDashboard)
	}

	// Snapshot the identity + cache flag + Query V2 signal; the goroutine must not touch the request
	// or its context (both are tied to the HTTP request's lifetime, which ends when we return 202).
	user := c.SignedInUser
	skipDSCache := c.SkipDSCache
	// Mirror QueryDiagnostics' dispatch (see ds_query_diagnostics.go) so each panel runs with the
	// same per-query time range semantics the panel itself would use -- otherwise captured traffic
	// wouldn't match a dashboard that uses Query V2, defeating the "reproduce offline" goal.
	useQueryDataNew := c.Req.Header.Get("X-Query-V2") == "true"

	// detachedCtx carries its own cloned *http.Request (see contexthandler.CopyWithReqContext), so
	// it stays safe to use after this handler returns. CopyWithReqContext only clones the request;
	// it does not detach from cancellation, and the parent request's context is canceled by net/http
	// as soon as this handler returns -- so context.WithoutCancel first, or the background goroutine
	// below would be canceled within microseconds of starting, before any panel query completes.
	// Force SkipQueryCache on it so a cache-hit query still goes to the wire under capture --
	// otherwise HAR capture runs on nothing and traffic.har is silently empty (same requirement as
	// QueryDiagnostics in ds_query_diagnostics.go for the single-panel path, where c.SkipQueryCache
	// is set directly on the request's ReqContext).
	detachedCtx := contexthandler.CopyWithReqContext(context.WithoutCancel(c.Req.Context()))
	if reqCtx := contexthandler.FromContext(detachedCtx); reqCtx != nil {
		reqCtx.SkipQueryCache = true
	}

	go func(uid string, user identity.Requester, skipDSCache, useQueryDataNew bool, req dashboardDiagnosticsRequest) {
		defer func() {
			if r := recover(); r != nil {
				dashboardDiagnosticsJobs.fail(uid, fmt.Errorf("dashboard diagnostics panic: %v", r))
				if hs.diagnosticsMetrics != nil {
					hs.diagnosticsMetrics.RecordCompleted(detachedCtx, diagnostics.ScopeDashboard, diagnostics.ResultError)
				}
			}
		}()

		archive, err := hs.buildDashboardDiagnosticsArchive(detachedCtx, user, skipDSCache, useQueryDataNew, req, uid)
		if err != nil {
			dashboardDiagnosticsJobs.fail(uid, err)
			if hs.diagnosticsMetrics != nil {
				hs.diagnosticsMetrics.RecordCompleted(detachedCtx, diagnostics.ScopeDashboard, diagnostics.ResultError)
			}
			return
		}
		dashboardDiagnosticsJobs.complete(uid, archive)
		if hs.diagnosticsMetrics != nil {
			hs.diagnosticsMetrics.RecordCompleted(detachedCtx, diagnostics.ScopeDashboard, diagnostics.ResultSuccess)
		}
	}(job.UID, user, skipDSCache, useQueryDataNew, reqDTO)

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
func (hs *HTTPServer) buildDashboardDiagnosticsArchive(ctx context.Context, user identity.Requester, skipDSCache, useQueryDataNew bool, reqDTO dashboardDiagnosticsRequest, jobUID string) ([]byte, error) {
	queryData := hs.queryDataService.QueryData
	if useQueryDataNew {
		queryData = hs.queryDataService.QueryDataNew
	}

	panels := make([]diagnostics.DashboardPanel, 0, len(reqDTO.Panels))
	for i, p := range reqDTO.Panels {
		// ctx is detachedCtx (see QueryDashboardDiagnostics), derived from context.WithoutCancel, so
		// this never fires today -- there is no per-run timeout yet (MVP scope, see the NOTE above).
		// Kept so this loop bails out for free once that follow-up wires up a cancelable context.
		if err := ctx.Err(); err != nil {
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
		resp, err := queryData(pctx, user, skipDSCache, p.MetricRequest)
		panel.HARBuffer = harBuffer
		panel.Resp = resp // carries external (gRPC) plugins' __har__ capture frames, merged in BuildDashboard
		// A datasource query usually fails per-refId (DataResponse.Error) with no top-level error
		// (see diagnostics.ResponseError doc) -- capture that too, or a failed panel would be recorded
		// in the manifest as having run successfully with no query-error.txt. An externalized plugin
		// carries its swallowed top-level error in the __har__ frame instead (PluginCaptureError); fold
		// both in the same way the single-panel path does.
		panel.QueryErr = err
		if panel.QueryErr == nil {
			panel.QueryErr = errors.Join(diagnostics.ResponseError(resp), diagnostics.PluginCaptureError(resp))
		}

		panels = append(panels, panel)
		dashboardDiagnosticsJobs.setProgress(jobUID, i+1)
	}

	return diagnostics.NewBundler().BuildDashboard(reqDTO.Dashboard, panels)
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
