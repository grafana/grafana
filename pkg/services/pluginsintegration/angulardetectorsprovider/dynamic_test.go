package angulardetectorsprovider

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
)

func TestDynamicAngularDetectorsProvider(t *testing.T) {
	gcom := newDefaultGCOMScenario()
	srv := gcom.newHTTPTestServer()
	t.Cleanup(srv.Close)

	var mockGCOMPatterns GCOMPatterns
	require.NoError(t, json.Unmarshal(mockGCOMResponse, &mockGCOMPatterns))
	svc := provideDynamic(t, srv.URL, defaultCacheTTL)
	mockGCOMDetectors, err := svc.patternsToDetectors(mockGCOMPatterns)
	require.NoError(t, err)

	t.Run("patternsToDetectors", func(t *testing.T) {
		t.Run("valid", func(t *testing.T) {
			d, err := svc.patternsToDetectors(mockGCOMPatterns)
			require.NoError(t, err)
			checkMockDetectors(t, d)
		})

		t.Run("invalid regex", func(t *testing.T) {
			_, err := svc.patternsToDetectors(GCOMPatterns{GCOMPattern{Name: "invalid", Type: GCOMPatternTypeRegex, Pattern: `[`}})
			require.Error(t, err)
		})

		t.Run("unknown pattern type is ignored silently", func(t *testing.T) {
			// Tests that we can introduce new pattern types in the future without breaking old Grafana versions.
			newPatterns := make(GCOMPatterns, len(mockGCOMPatterns))
			copy(newPatterns, mockGCOMPatterns)

			// Add an unknown pattern at the end
			newPatterns = append(newPatterns, GCOMPattern{Name: "Unknown", Pattern: "Unknown", Type: "Unknown"})

			// Convert patterns to detector and the unknown one should be silently ignored
			detectors, err := svc.patternsToDetectors(newPatterns)
			require.NoError(t, err)
			checkMockDetectors(t, detectors)
		})
	})

	t.Run("ProvideDetectors", func(t *testing.T) {
		t.Run("returns empty result by default", func(t *testing.T) {
			svc := provideDynamic(t, srv.URL, defaultCacheTTL, dynamicWithInitialRestoreDone)
			r := svc.ProvideDetectors(context.Background())
			require.Empty(t, r)
		})

		t.Run("returns cached detectors", func(t *testing.T) {
			svc := provideDynamic(t, srv.URL, defaultCacheTTL, dynamicWithInitialRestoreDone)
			svc.setDetectors(mockGCOMDetectors)
			checkMockDetectors(t, svc.ProvideDetectors(context.Background()))
		})

		t.Run("awaits initial restore done", func(t *testing.T) {
			t.Parallel()
			svc := provideDynamic(t, srv.URL, defaultCacheTTL)
			done := make(chan struct{})
			go func() {
				time.Sleep(time.Second * 1)
				svc.setDetectors(mockGCOMDetectors)
				svc.notifyInitialRestoreDone()
				// ensure the value is read and this goroutine exits
				done <- struct{}{}
			}()
			r := svc.ProvideDetectors(context.Background())
			checkMockDetectors(t, r)
			<-done
		})
	})

	t.Run("fetch", func(t *testing.T) {
		t.Run("returns value from gcom api", func(t *testing.T) {
			r, err := svc.fetch(context.Background())
			require.NoError(t, err)

			require.True(t, gcom.httpCalls.calledOnce(), "gcom api should be called")
			require.Equal(t, mockGCOMPatterns, r)
		})

		t.Run("handles timeout", func(t *testing.T) {
			// ctx that expired in the past
			ctx, canc := context.WithDeadline(context.Background(), time.Now().Add(time.Second*-30))
			defer canc()
			_, err := svc.fetch(ctx)
			require.ErrorIs(t, err, context.DeadlineExceeded)
			require.False(t, gcom.httpCalls.called(), "gcom api should not be called")
			require.Empty(t, svc.detectors)
		})
	})

	t.Run("tryUpdateDetectors", func(t *testing.T) {
		t.Run("successful", func(t *testing.T) {
			svc := provideDynamic(t, srv.URL, defaultCacheTTL)

			// Check that store is initially empty
			dbV, err := svc.store.Get(context.Background())
			require.ErrorIs(t, err, angularpatternsstore.ErrNoCachedValue)
			require.Empty(t, dbV, "initial store should be empty")
			lastUpdated, err := svc.store.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.Zero(t, lastUpdated)

			// Also check in-memory detectors
			require.Empty(t, svc.detectors)

			// Fetch and store value, and ensure it returns the correct value
			svc.tryUpdateDetectors(context.Background())

			// Check that the cached detectors have been updated as well
			checkMockDetectors(t, svc.detectors)

			// Check that the value has been updated in the kv store, by reading from the store directly
			dbV, err = svc.store.Get(context.Background())
			require.NoError(t, err)
			require.NotEmpty(t, dbV, "new store should not be empty")
			var patterns GCOMPatterns
			require.NoError(t, json.Unmarshal([]byte(dbV), &patterns), "could not unmarshal stored value")
			require.Equal(t, mockGCOMPatterns, patterns)

			// Check that last updated has been updated in the kv store (which is used for cache ttl)
			lastUpdated, err = svc.store.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.WithinDuration(t, lastUpdated, time.Now(), time.Second*10, "last updated in store has not been updated")
		})

		t.Run("gcom error does not update store", func(t *testing.T) {
			// GCOM scenario that always returns a 500
			scenario := newError500GCOMScenario()
			srv := scenario.newHTTPTestServer()
			t.Cleanup(srv.Close)

			svc := provideDynamic(t, srv.URL, defaultCacheTTL)

			// Set initial cached detectors
			svc.setDetectors(mockGCOMDetectors)

			// Set initial patterns store as well
			err = svc.store.Set(context.Background(), mockGCOMPatterns)
			require.NoError(t, err)

			// Try to update from GCOM, but it returns an error
			svc.tryUpdateDetectors(context.Background())
			require.True(t, scenario.httpCalls.calledOnce(), "gcom api should be called once")

			// Patterns in store should not be modified
			dbV, err := svc.store.Get(context.Background())
			require.NoError(t, err)
			require.NotEmpty(t, dbV)
			var newPatterns GCOMPatterns
			err = json.Unmarshal([]byte(dbV), &newPatterns)
			require.NoError(t, err)
			require.Equal(t, mockGCOMPatterns, newPatterns, "store should not be modified")

			// Same for in-memory detectors
			checkMockDetectors(t, svc.detectors)
		})
	})

	t.Run("setDetectorsFromCache", func(t *testing.T) {
		t.Run("empty store doesn't return an error", func(t *testing.T) {
			svc := provideDynamic(t, srv.URL, defaultCacheTTL)

			err := svc.setDetectorsFromCache(context.Background())
			require.NoError(t, err)
			require.Empty(t, svc.detectors)
		})

		t.Run("store is restored", func(t *testing.T) {
			svc := provideDynamic(t, srv.URL, defaultCacheTTL)

			// Populate store
			err := svc.store.Set(context.Background(), mockGCOMPatterns)
			require.NoError(t, err)

			// Restore
			require.Empty(t, svc.detectors, "initial detectors should be empty")
			err = svc.setDetectorsFromCache(context.Background())
			require.NoError(t, err)
			require.Equal(t, mockGCOMDetectors, svc.detectors)
		})
	})

	t.Run("background service", func(t *testing.T) {
		t.Run("restores value from db when it starts", func(t *testing.T) {
			gcom := newDefaultGCOMScenario()
			srv := gcom.newHTTPTestServer()
			t.Cleanup(srv.Close)
			svc := provideDynamic(t, srv.URL, defaultCacheTTL)

			// Set initial store
			err := svc.store.Set(context.Background(), mockGCOMPatterns)
			require.NoError(t, err)

			// Start bg service scenario and test
			bg := newBackgroundServiceScenario(svc, func() {})
			t.Cleanup(bg.close)
			bg.run(context.Background(), t)
			d := svc.ProvideDetectors(context.Background())
			checkMockDetectors(t, d)
			require.False(t, gcom.httpCalls.called(), "gcom api should not be called")

			bg.exitAndWait()
		})

		t.Run("fetches value from gcom on start if too much time has passed", func(t *testing.T) {
			gcom := newDefaultGCOMScenario()
			srv := gcom.newHTTPTestServer()
			svc := provideDynamic(t, srv.URL, defaultCacheTTL)
			mockStore := &mockLastUpdatePatternsStore{
				Service: svc.store,
				// Expire cache
				lastUpdated: time.Now().Add(defaultCacheTTL * -2),
			}
			svc.store = mockStore

			// Store mock GCOM pattern without the first one
			err = mockStore.Set(context.Background(), mockGCOMPatterns[1:])
			require.NoError(t, err)

			// Start bg service and it should call GCOM immediately
			callback := make(chan struct{})
			var once sync.Once
			bg := newBackgroundServiceScenario(svc, func() {
				once.Do(func() {
					callback <- struct{}{}
				})
			})
			t.Cleanup(bg.close)
			bg.run(context.Background(), t)

			// Await job call with timeout
			select {
			case <-time.After(time.Second * 10):
				t.Fatal("timeout")
			case <-callback:
				break
			}
			require.True(t, gcom.httpCalls.calledOnce(), "gcom api should be called once")

			// Check new cached value
			checkMockDetectors(t, svc.detectors)
			bg.exitAndWait()
		})

		t.Run("runs the job periodically", func(t *testing.T) {
			t.Parallel()
			const tcRuns = 3

			gcom := newDefaultGCOMScenario()
			srv := gcom.newHTTPTestServer()
			t.Cleanup(srv.Close)
			jobInterval := time.Millisecond * 500
			svc := provideDynamic(t, srv.URL, jobInterval)
			done := make(chan struct{})
			var jobCalls counter
			lastJobTime := time.Now()
			bg := newBackgroundServiceScenario(svc, func() {
				now := time.Now()
				assert.WithinDuration(t, now, lastJobTime, jobInterval+jobInterval/2)
				lastJobTime = now

				jobCalls.inc()
				if jobCalls.calls() == tcRuns {
					// this is done ONLY once
					done <- struct{}{}
					close(done)
				}
			})
			t.Cleanup(bg.close)
			// Refresh cache right before running the service, so we skip the initial run
			require.NoError(t, svc.store.Set(context.Background(), mockGCOMPatterns))
			bg.run(context.Background(), t)
			select {
			case <-time.After(time.Second * 10):
				t.Fatal("timeout")
			case <-done:
				break
			}
			bg.exitAndWait()

			require.True(t, jobCalls.calledX(tcRuns), "should have the correct number of job calls")
			require.True(t, gcom.httpCalls.calledX(tcRuns), "should have the correct number of gcom api calls")
		})
	})
}

var mockGCOMResponse = []byte(`[{
	"name": "PanelCtrl",
	"type": "contains",
	"pattern": "PanelCtrl"
},
{
    "name": "QueryCtrl",
    "type": "regex",
    "pattern": "[\"']QueryCtrl[\"']"
}]`)

func mockGCOMHTTPHandlerFunc(writer http.ResponseWriter, request *http.Request) {
	if request.URL.Path != "/api/plugins/angular_patterns" {
		writer.WriteHeader(http.StatusNotFound)
		return
	}
	_, _ = writer.Write(mockGCOMResponse)
}

func checkMockDetectors(t *testing.T, detectors []angulardetector.AngularDetector) {
	require.Len(t, detectors, 2)
	d, ok := detectors[0].(*angulardetector.ContainsBytesDetector)
	require.True(t, ok)
	require.Equal(t, []byte(`PanelCtrl`), d.Pattern)
	rd, ok := detectors[1].(*angulardetector.RegexDetector)
	require.True(t, ok)
	require.Equal(t, `["']QueryCtrl["']`, rd.Regex.String())
}

type counter struct {
	count           int
	lastAssertCount int
	mux             sync.Mutex
}

func (c *counter) inc() {
	c.mux.Lock()
	c.count++
	c.mux.Unlock()
}

func (c *counter) calls() int {
	c.mux.Lock()
	defer c.mux.Unlock()
	return c.count
}

func (c *counter) called() bool {
	c.mux.Lock()
	defer c.mux.Unlock()
	r := c.count > c.lastAssertCount
	c.lastAssertCount = c.count
	return r
}

func (c *counter) calledX(x int) bool {
	c.mux.Lock()
	defer c.mux.Unlock()
	r := c.count == x
	c.lastAssertCount = c.count
	return r
}

func (c *counter) calledOnce() bool {
	return c.calledX(1)
}

type gcomScenario struct {
	httpHandlerFunc http.HandlerFunc
	httpCalls       counter
}

func (s *gcomScenario) newHTTPTestServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.httpCalls.inc()
		s.httpHandlerFunc(w, r)
	}))
}

func newDefaultGCOMScenario() *gcomScenario {
	return &gcomScenario{httpHandlerFunc: func(w http.ResponseWriter, req *http.Request) {
		mockGCOMHTTPHandlerFunc(w, req)
	}}
}

func newError500GCOMScenario() *gcomScenario {
	return &gcomScenario{httpHandlerFunc: func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}}
}

func provideDynamic(t *testing.T, gcomURL string, cacheTTL time.Duration, opts ...func(*Dynamic)) *Dynamic {
	d, err := ProvideDynamic(
		&config.Cfg{GrafanaComURL: gcomURL},
		angularpatternsstore.ProvideService(kvstore.NewFakeKVStore()),
	)
	require.NoError(t, err)
	for _, opt := range opts {
		opt(d)
	}
	d.backgroundJobInterval = cacheTTL
	return d
}

func dynamicWithInitialRestoreDone(dynamic *Dynamic) {
	dynamic.notifyInitialRestoreDone()
}

// fakeBackgroundJob wraps a backgroundJob and writes a value to the callback channel
// whenever the job is executed.
type fakeBackgroundJob struct {
	inner backgroundJob

	// callback is a channel where a value is written after the background job is executed.
	// Read from this channel to await when the job is executed
	callback chan struct{}
}

func newFakeJober(inner backgroundJob) *fakeBackgroundJob {
	return &fakeBackgroundJob{inner: inner, callback: make(chan struct{})}
}

func (j *fakeBackgroundJob) close() {
	close(j.callback)
}

func (j *fakeBackgroundJob) runBackgroundJob(ctx context.Context) {
	j.inner.runBackgroundJob(ctx)
	j.callback <- struct{}{}
}

// mockLastUpdatePatternsStore wraps an angularpatternsstore.Service and returns a pre-defined value (lastUpdated)
// when calling GetLastUpdated. All other method calls are sent to the wrapped angularpatternsstore.Service.
type mockLastUpdatePatternsStore struct {
	angularpatternsstore.Service
	lastUpdated time.Time
}

// GetLastUpdated always returns s.lastUpdated.
func (s *mockLastUpdatePatternsStore) GetLastUpdated(_ context.Context) (time.Time, error) {
	return s.lastUpdated, nil
}

type backgroundServiceScenario struct {
	svc         *Dynamic
	fakeBgJob   *fakeBackgroundJob
	bgDone      chan struct{}
	wg          sync.WaitGroup
	ctxCancFunc context.CancelFunc
}

func newBackgroundServiceScenario(svc *Dynamic, callback func()) *backgroundServiceScenario {
	s := &backgroundServiceScenario{
		svc:       svc,
		bgDone:    make(chan struct{}),
		fakeBgJob: newFakeJober(svc),
	}
	svc.backgroundJob = s.fakeBgJob
	go func() {
		for range s.fakeBgJob.callback {
			callback()
		}
	}()
	return s
}

func (s *backgroundServiceScenario) close() {
	if s.ctxCancFunc == nil {
		return
	}
	s.ctxCancFunc()
}

func (s *backgroundServiceScenario) exitAndWait() {
	if s.ctxCancFunc == nil {
		panic("run was not called")
	}
	// Make bg service exit
	s.close()
	s.ctxCancFunc = nil
	// Wait for bg svc to quit
	s.wg.Wait()
}

func (s *backgroundServiceScenario) run(ctx context.Context, t *testing.T) {
	if s.ctxCancFunc != nil {
		panic("run was called more than once")
	}
	ctx, canc := context.WithCancel(ctx)
	// Store this canc func, so we can make the bg goroutine exit on demand
	s.ctxCancFunc = canc

	// Start background service
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		err := s.svc.Run(ctx)
		if err != nil && !errors.Is(err, context.Canceled) {
			panic(err)
		}
		// Make the consumer goroutine quit
		s.fakeBgJob.close()
		// Signal that the bg service has quit
		close(s.bgDone)
	}()
}
