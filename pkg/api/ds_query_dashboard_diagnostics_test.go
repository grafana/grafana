package api

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	backend "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/diagnostics"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

// TestQueryDashboardDiagnostics_survivesRequestContextCancellation guards against a regression
// where the background generation goroutine was derived from the initiating HTTP request's own
// context. net/http cancels that context as soon as the handler returns (see Request.Context
// docs), which happens almost immediately after this handler kicks off the goroutine and responds
// 202 -- so the generation must not inherit that cancellation. It also guards the SkipQueryCache
// forcing on the detached context: without it, HAR capture would run on a cache hit and
// traffic.har would be silently empty (see QueryDashboardDiagnostics).
func TestQueryDashboardDiagnostics_survivesRequestContextCancellation(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)

	var capturedCtx atomic.Pointer[context.Context]
	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			ctxArg := args.Get(0).(context.Context)
			capturedCtx.Store(&ctxArg)
		}).
		Return(backend.NewQueryDataResponse(), nil)
	hs := &HTTPServer{queryDataService: fakeQuery}

	body := `{"panels":[{"id":1,"title":"Panel 1","from":"now-1h","to":"now","queries":[{"refId":"A","datasource":{"uid":"prom"}}]}]}`
	req, err := http.NewRequest(http.MethodPost, "/api/ds/dashboard-diagnostics", strings.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	// A cancelable context stands in for the real *http.Request context, which net/http cancels
	// as soon as ServeHTTP returns.
	cancelableCtx, cancelReq := context.WithCancel(req.Context())
	req = req.WithContext(cancelableCtx)

	c := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder()),
		},
		SignedInUser: &user.SignedInUser{OrgID: 1, UserUID: "u1"},
		Logger:       log.New("test"),
	}

	// Wire c into its own request's context via ctxkey.Key{}, the same key the real
	// ContextHandler middleware uses for every request (see contexthandler.FromContext). Without
	// this, contexthandler.FromContext(c.Req.Context()) finds nothing, CopyWithReqContext silently
	// no-ops, and the SkipQueryCache forcing below would never reach the detached context -- but
	// nothing here would fail, since a fake queryDataService doesn't care what's in the context.
	req = req.WithContext(context.WithValue(req.Context(), ctxkey.Key{}, c))
	c.Req = req

	resp := hs.QueryDashboardDiagnostics(c)
	require.Equal(t, http.StatusAccepted, resp.Status())

	var accepted map[string]any
	require.NoError(t, json.Unmarshal(resp.Body(), &accepted))
	uid, _ := accepted["uid"].(string)
	require.NotEmpty(t, uid)

	// Simulate net/http canceling the request's context immediately after the handler returns --
	// exactly what happens in production once the 202 response is written.
	cancelReq()

	require.Eventually(t, func() bool {
		snap, ok := dashboardDiagnosticsJobs.snapshot(uid, c.SignedInUser)
		return ok && snap.State != jobPending
	}, 2*time.Second, 10*time.Millisecond, "job never left pending state")

	snap, ok := dashboardDiagnosticsJobs.snapshot(uid, c.SignedInUser)
	require.True(t, ok)
	require.Equal(t, jobComplete, snap.State,
		"job must complete even though the initiating request's context was canceled after the handler returned")
	require.Empty(t, snap.Err)

	queryCtxPtr := capturedCtx.Load()
	require.NotNil(t, queryCtxPtr, "queryDataService.QueryData was never called")
	queryReqCtx := contexthandler.FromContext(*queryCtxPtr)
	require.NotNil(t, queryReqCtx, "the detached context passed to QueryData must carry a ReqContext")
	require.True(t, queryReqCtx.SkipQueryCache,
		"SkipQueryCache must be forced on the detached context, or a cache hit would skip the wire and traffic.har would be silently empty")
	require.False(t, c.SkipQueryCache,
		"the original request's ReqContext must not be mutated -- QueryDashboardDiagnostics forces the flag on a clone")
}

// TestQueryDashboardDiagnostics_rejectsWhenInFlightCapReached guards the in-flight cap at the
// handler boundary: once diagnosticsMaxInFlightJobs generations are already pending, a further POST
// must be rejected with 429 rather than starting yet another detached goroutine.
func TestQueryDashboardDiagnostics_rejectsWhenInFlightCapReached(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)

	// Swap the process-wide store for an isolated one pre-filled to the in-flight cap, and restore it
	// after so this test neither sees nor leaks pending jobs into others that share the global store.
	prev := dashboardDiagnosticsJobs
	t.Cleanup(func() { dashboardDiagnosticsJobs = prev })
	dashboardDiagnosticsJobs = &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}
	creator := &user.SignedInUser{OrgID: 1, UserUID: "u1"}
	for i := 0; i < diagnosticsMaxInFlightJobs; i++ {
		_, ok := dashboardDiagnosticsJobs.create(1, creator)
		require.True(t, ok, "setup: pre-filling the store to the cap must succeed")
	}

	// create() rejects before the handler touches queryDataService, so no fake is needed.
	hs := &HTTPServer{}

	body := `{"panels":[{"id":1,"title":"Panel 1","from":"now-1h","to":"now","queries":[{"refId":"A","datasource":{"uid":"prom"}}]}]}`
	req, err := http.NewRequest(http.MethodPost, "/api/ds/dashboard-diagnostics", strings.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	c := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder()),
		},
		SignedInUser: creator,
		Logger:       log.New("test"),
	}
	c.Req = req

	resp := hs.QueryDashboardDiagnostics(c)
	require.Equal(t, http.StatusTooManyRequests, resp.Status(),
		"a create beyond the in-flight cap must be rejected with 429, not started")
	// The rejected request must not have created a job.
	require.Len(t, dashboardDiagnosticsJobs.jobs, diagnosticsMaxInFlightJobs,
		"a rejected request must not add a job to the store")
}

// TestBuildDashboardDiagnosticsArchive_recordsPerRefIDQueryError guards against a regression where
// QueryData's response was discarded, so a per-refId failure (backend.DataResponse.Error, the usual
// way a datasource query fails -- see diagnostics.ResponseError) never reached panel.QueryErr: the
// panel was recorded in the manifest as having run successfully, with no query-error.txt.
func TestBuildDashboardDiagnosticsArchive_recordsPerRefIDQueryError(t *testing.T) {
	fakeQuery := query.NewFakeQueryService(t)
	failing := backend.NewQueryDataResponse()
	failing.Responses["A"] = backend.DataResponse{Error: errors.New("datasource exploded")}
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(failing, nil)
	hs := &HTTPServer{queryDataService: fakeQuery}

	reqDTO := dashboardDiagnosticsRequest{
		Panels: []panelDiagnosticsSpec{{
			ID:    1,
			Title: "Panel 1",
			MetricRequest: dtos.MetricRequest{
				Queries: []*simplejson.Json{simplejson.NewFromAny(map[string]any{"refId": "A"})},
			},
		}},
	}

	archive, _, err := hs.buildDashboardDiagnosticsArchive(context.Background(), &user.SignedInUser{OrgID: 1, UserUID: "u1"}, false, false, reqDTO, "job-1")
	require.NoError(t, err)

	files := readTarGzFiles(t, archive)
	require.Contains(t, files, "manifest.json", "manifest.json must be present")
	require.Contains(t, string(files["manifest.json"]), "datasource exploded",
		"a per-refId query failure must be recorded in the manifest, not silently dropped")
}

func TestBuildDashboardDiagnosticsArchive_recordsSubmittedQueryRequest(t *testing.T) {
	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(backend.NewQueryDataResponse(), nil)
	hs := &HTTPServer{queryDataService: fakeQuery}

	reqDTO := dashboardDiagnosticsRequest{
		Panels: []panelDiagnosticsSpec{{
			ID:    1,
			Title: "Panel 1",
			MetricRequest: dtos.MetricRequest{
				From:    "now-1h",
				To:      "now",
				Queries: []*simplejson.Json{simplejson.NewFromAny(map[string]any{"refId": "A", "expr": "up"})},
			},
		}},
	}

	archive, _, err := hs.buildDashboardDiagnosticsArchive(context.Background(), &user.SignedInUser{OrgID: 1, UserUID: "u1"}, false, false, reqDTO, "job-querydata")
	require.NoError(t, err)

	files := readTarGzFiles(t, archive)
	require.Contains(t, files, "panels/1-panel-1/querydata.json")
	require.Contains(t, string(files["panels/1-panel-1/querydata.json"]), `"expr": "up"`)
}

// TestBuildDashboardDiagnosticsArchive_queryV2Dispatch guards against a regression where the
// dashboard-level path always called QueryData, ignoring the X-Query-V2 signal that QueryDiagnostics
// (the single-panel path) honors -- so captured traffic wouldn't match a panel using Query V2's
// per-query time ranges.
func TestBuildDashboardDiagnosticsArchive_queryV2Dispatch(t *testing.T) {
	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryDataNew", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(backend.NewQueryDataResponse(), nil).Once()
	hs := &HTTPServer{queryDataService: fakeQuery}

	reqDTO := dashboardDiagnosticsRequest{
		Panels: []panelDiagnosticsSpec{{
			ID: 1,
			MetricRequest: dtos.MetricRequest{
				Queries: []*simplejson.Json{simplejson.NewFromAny(map[string]any{"refId": "A"})},
			},
		}},
	}

	_, _, err := hs.buildDashboardDiagnosticsArchive(context.Background(), &user.SignedInUser{OrgID: 1, UserUID: "u1"}, false, true, reqDTO, "job-2")
	require.NoError(t, err)
}

func readTarGzFiles(t *testing.T, data []byte) map[string][]byte {
	t.Helper()
	gz, err := gzip.NewReader(bytes.NewReader(data))
	require.NoError(t, err)
	tr := tar.NewReader(gz)
	files := map[string][]byte{}
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		buf, err := io.ReadAll(tr)
		require.NoError(t, err)
		files[hdr.Name] = buf
	}
	return files
}

func TestDiagnosticsJobStore_lifecycle(t *testing.T) {
	s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}
	creator := &user.SignedInUser{OrgID: 1, UserUID: "creator"}
	someoneElse := &user.SignedInUser{OrgID: 1, UserUID: "someone-else"}

	job, ok := s.create(3, creator)
	require.True(t, ok)
	require.NotEmpty(t, job.UID)

	snap, ok := s.snapshot(job.UID, creator)
	require.True(t, ok)
	require.Equal(t, jobPending, snap.State)
	require.Equal(t, 3, snap.PanelsTotal)

	s.setProgress(job.UID, 2)
	snap, _ = s.snapshot(job.UID, creator)
	require.Equal(t, 2, snap.PanelsDone)

	// Before completion there is no downloadable archive.
	_, state, ok := s.archiveOf(job.UID, creator)
	require.True(t, ok)
	require.Equal(t, jobPending, state)

	s.complete(job.UID, []byte("archive-bytes"), diagnostics.BundleResult{})
	archive, state, ok := s.archiveOf(job.UID, creator)
	require.True(t, ok)
	require.Equal(t, jobComplete, state)
	require.Equal(t, []byte("archive-bytes"), archive)

	// A different identity gets the same "not found" as an unknown UID -- it must not be able to
	// tell the job exists at all, let alone read its status or archive.
	_, ok = s.snapshot(job.UID, someoneElse)
	require.False(t, ok, "a different identity must not see another creator's job")
	_, _, ok = s.archiveOf(job.UID, someoneElse)
	require.False(t, ok, "a different identity must not download another creator's archive")

	// A failed job carries its error and stays without an archive.
	otherJob, _ := s.create(1, creator)
	s.fail(otherJob.UID, errors.New("boom"))
	snap, _ = s.snapshot(otherJob.UID, creator)
	require.Equal(t, jobError, snap.State)
	require.Equal(t, "boom", snap.Err)

	// Unknown UID is reported as not found.
	_, ok = s.snapshot("nope", creator)
	require.False(t, ok)
}

func TestDiagnosticsJobStore_prune(t *testing.T) {
	creator := &user.SignedInUser{OrgID: 1, UserUID: "creator"}

	// Retention TTL: a terminal job older than the retention window is pruned on the next create, so
	// the store can't accumulate finished/abandoned jobs (and their archive bytes) forever.
	t.Run("evicts terminal jobs past the retention TTL", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}
		stale, _ := s.create(1, creator)
		s.complete(stale.UID, []byte("done"), diagnostics.BundleResult{})
		// Retention is measured from finishedAt, so age that (not CreatedAt).
		s.jobs[stale.UID].finishedAt = time.Now().Add(-diagnosticsJobRetention - time.Minute)

		fresh, _ := s.create(1, creator) // triggers pruneLocked
		_, ok := s.snapshot(stale.UID, creator)
		require.False(t, ok, "stale terminal job should have been pruned")
		_, ok = s.snapshot(fresh.UID, creator)
		require.True(t, ok, "fresh job should remain")
	})

	// A job that took longer than the retention window to generate must still be downloadable right
	// after it completes: retention runs from finishedAt, not CreatedAt.
	t.Run("keeps a slow job that just finished even if created long ago", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}
		slow, _ := s.create(1, creator)
		s.jobs[slow.UID].CreatedAt = time.Now().Add(-diagnosticsJobRetention - time.Hour) // long run
		s.complete(slow.UID, []byte("done"), diagnostics.BundleResult{})                  // finishedAt = now

		s.create(1, creator) // triggers pruneLocked
		_, ok := s.snapshot(slow.UID, creator)
		require.True(t, ok, "a just-finished job must not be pruned by its old start time")
	})

	// A still-pending (in-flight) job is never evicted, even past the TTL: its goroutine is still
	// writing to it, so dropping it would orphan the run.
	t.Run("never evicts a pending in-flight job", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}
		pending, _ := s.create(1, creator)
		s.jobs[pending.UID].CreatedAt = time.Now().Add(-diagnosticsJobRetention - time.Hour)

		s.create(1, creator) // triggers pruneLocked
		_, ok := s.snapshot(pending.UID, creator)
		require.True(t, ok, "a pending job must survive pruning regardless of age")
	})

	// Byte budget: a burst of finished jobs within the retention window can't grow the store past the
	// retained-archive budget; the oldest terminal jobs are evicted first. A tiny per-store budget stands
	// in for the real one, which is far larger than a test can afford to allocate.
	t.Run("evicts oldest terminal jobs beyond the byte budget", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}, maxBytes: 300}
		base := time.Now()
		var oldest string
		for i := 0; i < 3; i++ {
			j, _ := s.create(1, creator)
			s.complete(j.UID, make([]byte, 100), diagnostics.BundleResult{})
			s.jobs[j.UID].finishedAt = base.Add(time.Duration(i) * time.Second)
			if i == 0 {
				oldest = j.UID
			}
		}
		require.Len(t, s.jobs, 3, "three 100-byte archives exactly fill a 300-byte budget")

		// A fourth pushes the total to 400 over a 300 budget, so exactly the oldest must go.
		newest, _ := s.create(1, creator)
		s.complete(newest.UID, make([]byte, 100), diagnostics.BundleResult{})
		require.Len(t, s.jobs, 3)
		_, ok := s.snapshot(oldest, creator)
		require.False(t, ok, "oldest terminal job should have been evicted")
		_, ok = s.snapshot(newest.UID, creator)
		require.True(t, ok, "newest job should remain")
	})

	// Eviction frees only as much as it must: one large archive can displace several small ones, and a
	// count-based cap could not express that.
	t.Run("evicts by bytes rather than by job count", func(t *testing.T) {
		// 380 retained against 330: dropping the oldest 50 is enough, so the second small job survives.
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}, maxBytes: 330}
		base := time.Now()
		add := func(uid string, size int, finished time.Time) {
			s.jobs[uid] = &diagnosticsJob{
				UID: uid, State: jobComplete, finishedAt: finished, archive: make([]byte, size),
				createdByOrgID: creator.GetOrgID(), createdByUID: creator.GetUID(),
			}
		}
		add("small-1", 50, base)
		add("small-2", 50, base.Add(time.Second))
		add("big", 280, base.Add(2*time.Second))

		s.pruneLocked(base.Add(3 * time.Second))
		require.NotContains(t, s.jobs, "small-1", "the oldest goes first")
		require.Contains(t, s.jobs, "small-2", "eviction stops as soon as the rest fit")
		require.Contains(t, s.jobs, "big")
	})

	// Eviction orders by finishedAt, not CreatedAt: a slow run created long ago but finished most
	// recently is the freshest result and must survive, while a run created recently but finished
	// earliest is the one to evict. Ordering by CreatedAt would 404 the just-finished bundle.
	t.Run("evicts oldest by finishedAt not CreatedAt", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}, maxBytes: 200}
		base := time.Now()
		add := func(uid string, created, finished time.Time) {
			s.jobs[uid] = &diagnosticsJob{
				UID: uid, State: jobComplete, CreatedAt: created, finishedAt: finished,
				archive:        make([]byte, 100),
				createdByOrgID: creator.GetOrgID(), createdByUID: creator.GetUID(),
			}
		}
		add("fill", base, base)
		add("slow-but-fresh", base.Add(-time.Hour), base.Add(time.Minute))  // oldest CreatedAt, newest finishedAt
		add("quick-but-stale", base.Add(time.Hour), base.Add(-time.Minute)) // newest CreatedAt, oldest finishedAt

		s.pruneLocked(base.Add(2 * time.Minute)) // 300 retained over a 200 budget
		require.Contains(t, s.jobs, "slow-but-fresh",
			"a job finished most recently must survive even if created long ago")
		require.NotContains(t, s.jobs, "quick-but-stale",
			"a job finished earliest must be evicted even if created most recently")
	})

	// The newest terminal job is never evicted, even alone over budget: it is the result the caller is
	// about to download, and its size is already bounded by diagnostics.MaxBundleBytes.
	t.Run("keeps the newest job even when it alone exceeds the budget", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}, maxBytes: 100}
		base := time.Now()
		s.jobs["old"] = &diagnosticsJob{UID: "old", State: jobComplete, finishedAt: base, archive: make([]byte, 50)}
		s.jobs["huge"] = &diagnosticsJob{UID: "huge", State: jobComplete, finishedAt: base.Add(time.Second), archive: make([]byte, 5000)}

		s.pruneLocked(base.Add(2 * time.Second))
		require.NotContains(t, s.jobs, "old")
		require.Contains(t, s.jobs, "huge", "the freshest result must survive rather than 404 a finished generation")
	})

	// Pruning must also happen when a job goes terminal, not only on create: if the store is already at
	// the budget and one more job completes, complete() itself must evict with no intervening create().
	t.Run("enforces the budget on complete without a later create", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}, maxBytes: 200}
		base := time.Now()
		for i := 0; i < 2; i++ {
			uid := fmt.Sprintf("term-%d", i)
			s.jobs[uid] = &diagnosticsJob{UID: uid, State: jobComplete, finishedAt: base.Add(time.Duration(i) * time.Second), archive: make([]byte, 100)}
		}
		// One extra in-flight job, built directly so no prune has run yet.
		s.jobs["pending"] = &diagnosticsJob{UID: "pending", State: jobPending, CreatedAt: base}
		require.Len(t, s.jobs, 3)

		// Completing it adds 100 bytes over a 200 budget; complete()'s own prune must evict the oldest.
		s.complete("pending", make([]byte, 100), diagnostics.BundleResult{})
		require.Len(t, s.jobs, 2, "complete() must evict down to the budget on its own")
		require.Contains(t, s.jobs, "pending", "the just-completed job is the newest by finishedAt and must survive")
		require.NotContains(t, s.jobs, "term-0", "the oldest terminal job is the one evicted")
	})

	// In-flight cap: only diagnosticsMaxInFlightJobs generations may be pending at once. Further
	// creates are rejected (ok=false, nil job) until one finishes, so an admin repeatedly POSTing
	// large dashboards can't spawn unbounded long-lived goroutines.
	t.Run("caps concurrent in-flight jobs", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}
		var last *diagnosticsJob
		for i := 0; i < diagnosticsMaxInFlightJobs; i++ {
			j, ok := s.create(1, creator)
			require.True(t, ok, "creates within the in-flight cap must succeed")
			last = j
		}

		j, ok := s.create(1, creator)
		require.False(t, ok, "a create beyond the in-flight cap must be rejected")
		require.Nil(t, j)
		require.Len(t, s.jobs, diagnosticsMaxInFlightJobs, "a rejected create must not add a job")

		// Finishing one frees a slot, so a new create succeeds again.
		s.complete(last.UID, nil, diagnostics.BundleResult{})
		_, ok = s.create(1, creator)
		require.True(t, ok, "a slot frees up once an in-flight job finishes")
	})
}

func TestJobOwnedBy_emptyUID(t *testing.T) {
	// GetUID() for concrete identities is a typed ID (e.g. "user:creator") and is never empty, but
	// jobOwnedBy still guards both sides so an unexpected empty UID can't fail open into a shared
	// "owner" that could read another's captured-traffic bundle.
	caller := &user.SignedInUser{OrgID: 1, UserUID: "creator"}

	emptyJob := &diagnosticsJob{createdByOrgID: 1, createdByUID: ""}
	require.False(t, jobOwnedBy(emptyJob, caller), "an empty stored UID must not match any caller")

	// A job created the normal way (UID via GetUID) is owned only by that same identity.
	owned := &diagnosticsJob{createdByOrgID: 1, createdByUID: caller.GetUID()}
	require.True(t, jobOwnedBy(owned, caller), "matching org + non-empty UID is owned")
	require.False(t, jobOwnedBy(owned, &user.SignedInUser{OrgID: 1, UserUID: "someone-else"}),
		"a different identity in the same org is not the owner")
}

func TestPanelDatasourceUIDs(t *testing.T) {
	q := func(uid string) *simplejson.Json {
		j := simplejson.New()
		if uid != "" {
			j.SetPath([]string{"datasource", "uid"}, uid)
		}
		return j
	}
	req := dtos.MetricRequest{Queries: []*simplejson.Json{q("prom"), q("prom"), q("loki"), q(""), nil}}
	// Deduplicated, in first-seen order; empty/nil entries dropped.
	require.Equal(t, []string{"prom", "loki"}, panelDatasourceUIDs(req))

	require.Empty(t, panelDatasourceUIDs(dtos.MetricRequest{}))
}

func TestPanelEnvironmentRefs(t *testing.T) {
	q := func(uid, dsType string) *simplejson.Json {
		j := simplejson.New()
		j.SetPath([]string{"datasource", "uid"}, uid)
		j.SetPath([]string{"datasource", "type"}, dsType)
		return j
	}

	t.Run("collects the datasource types and the viz plugin", func(t *testing.T) {
		req := dtos.MetricRequest{Queries: []*simplejson.Json{q("P1", "prometheus"), nil}}
		refs := panelEnvironmentRefs(req, json.RawMessage(`{"id":1,"type":"timeseries"}`))

		require.Equal(t, map[string]string{"P1": "prometheus"}, refs.DatasourcesByUID)
		require.Equal(t, []string{"prometheus", "timeseries"}, refs.PluginIDs())
	})

	t.Run("expression and ML nodes are recorded without a plugin id", func(t *testing.T) {
		// pkg/expr serves these, so resolving their type against the plugin store would report a
		// phantom uninstalled plugin in environment.json.
		req := dtos.MetricRequest{Queries: []*simplejson.Json{
			q("P1", "prometheus"),
			q(expr.DatasourceUID, expr.DatasourceType),
			q(expr.OldDatasourceUID, expr.DatasourceType),
			q(expr.MLDatasourceUID, "__ml__"),
		}}
		refs := panelEnvironmentRefs(req, nil)

		// Still present as UIDs, so every UID the manifest lists resolves in environment.json.
		require.Equal(t, map[string]string{
			"P1":                  "prometheus",
			expr.DatasourceUID:    "",
			expr.OldDatasourceUID: "",
			expr.MLDatasourceUID:  "",
		}, refs.DatasourcesByUID)
		require.Equal(t, []string{"prometheus"}, refs.PluginIDs(), "only real plugins are looked up")
	})
}
