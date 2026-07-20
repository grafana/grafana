package api

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
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
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
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

	archive, err := hs.buildDashboardDiagnosticsArchive(context.Background(), &user.SignedInUser{OrgID: 1, UserUID: "u1"}, false, false, reqDTO, "job-1")
	require.NoError(t, err)

	files := readTarGzFiles(t, archive)
	require.Contains(t, files, "manifest.json", "manifest.json must be present")
	require.Contains(t, string(files["manifest.json"]), "datasource exploded",
		"a per-refId query failure must be recorded in the manifest, not silently dropped")
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

	_, err := hs.buildDashboardDiagnosticsArchive(context.Background(), &user.SignedInUser{OrgID: 1, UserUID: "u1"}, false, true, reqDTO, "job-2")
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

	job := s.create(3, creator)
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

	s.complete(job.UID, []byte("archive-bytes"))
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
	otherJob := s.create(1, creator)
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
		stale := s.create(1, creator)
		s.complete(stale.UID, []byte("done"))
		s.jobs[stale.UID].CreatedAt = time.Now().Add(-diagnosticsJobRetention - time.Minute)

		fresh := s.create(1, creator) // triggers pruneLocked
		_, ok := s.snapshot(stale.UID, creator)
		require.False(t, ok, "stale terminal job should have been pruned")
		_, ok = s.snapshot(fresh.UID, creator)
		require.True(t, ok, "fresh job should remain")
	})

	// A still-pending (in-flight) job is never evicted, even past the TTL: its goroutine is still
	// writing to it, so dropping it would orphan the run.
	t.Run("never evicts a pending in-flight job", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}
		pending := s.create(1, creator)
		s.jobs[pending.UID].CreatedAt = time.Now().Add(-diagnosticsJobRetention - time.Hour)

		s.create(1, creator) // triggers pruneLocked
		_, ok := s.snapshot(pending.UID, creator)
		require.True(t, ok, "a pending job must survive pruning regardless of age")
	})

	// Max-entries cap: a burst of finished jobs within the retention window still can't grow the
	// store past the cap; the oldest terminal jobs are evicted first.
	t.Run("evicts oldest terminal jobs beyond the max-entries cap", func(t *testing.T) {
		s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}
		base := time.Now()
		var oldest string
		for i := 0; i < diagnosticsJobMaxEntries; i++ {
			j := s.create(1, creator)
			s.complete(j.UID, nil) // only terminal jobs count against the cap
			// Age them deterministically so eviction order is well-defined.
			s.jobs[j.UID].CreatedAt = base.Add(time.Duration(i) * time.Second)
			if i == 0 {
				oldest = j.UID
			}
		}
		require.Len(t, s.jobs, diagnosticsJobMaxEntries)

		// One more terminal job pushes over the cap and must evict exactly the oldest.
		newest := s.create(1, creator)
		s.complete(newest.UID, nil)
		s.pruneLocked(time.Now()) // complete() doesn't prune; force a sweep as the next create would
		require.Len(t, s.jobs, diagnosticsJobMaxEntries)
		_, ok := s.snapshot(oldest, creator)
		require.False(t, ok, "oldest terminal job should have been evicted")
		_, ok = s.snapshot(newest.UID, creator)
		require.True(t, ok, "newest job should remain")
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
