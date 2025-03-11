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
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDynamicAngularDetectorsProvider(t *testing.T) {
	mockGCOMPatterns := newMockGCOMPatterns()
	gcom := newDefaultGCOMScenario()
	srv := gcom.newHTTPTestServer()
	t.Cleanup(srv.Close)

	svc := provideDynamic(t, srv.URL)
	mockGCOMDetectors, err := svc.patternsToDetectors(mockGCOMPatterns)
	require.NoError(t, err)

	t.Run("patternsToDetectors", func(t *testing.T) {
		t.Run("valid", func(t *testing.T) {
			d, err := svc.patternsToDetectors(mockGCOMPatterns)
			require.NoError(t, err)
			checkMockDetectorsSlice(t, d)
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
			checkMockDetectorsSlice(t, detectors)
		})
	})

	t.Run("ProvideDetectors", func(t *testing.T) {
		t.Run("returns empty result by default", func(t *testing.T) {
			svc := provideDynamic(t, srv.URL)
			r := svc.ProvideDetectors(context.Background())
			require.Empty(t, r)
		})

		t.Run("awaits initial restore", func(t *testing.T) {
			// Prepare mock store
			mockStore := angularpatternsstore.ProvideService(kvstore.NewFakeKVStore())
			err := mockStore.Set(context.Background(), mockGCOMPatterns)
			require.NoError(t, err)

			svc := provideDynamic(t, srv.URL, provideDynamicOpts{
				store: mockStore,
			})

			// First call to ProvideDetectors should restore from store
			r := svc.ProvideDetectors(context.Background())
			checkMockDetectorsSlice(t, r)

			// Ensure the state is modified as well for future calls
			checkMockDetectors(t, svc)

			// Ensure it doesn't restore on every call, by modifying the detectors directly
			svc.mux.Lock()
			svc.detectors = nil
			svc.mux.Unlock()
			newR := svc.ProvideDetectors(context.Background())
			require.Empty(t, newR) // restore would have filled this with mockGCOMPatterns
		})
	})

	t.Run("fetch", func(t *testing.T) {
		t.Run("returns value from gcom api", func(t *testing.T) {
			r, err := svc.fetch(context.Background(), "")
			require.NoError(t, err)

			require.True(t, gcom.httpCalls.calledOnce(), "gcom api should be called")
			require.Equal(t, mockGCOMPatterns, r.Patterns)
			require.Empty(t, r.ETag)
		})

		t.Run("handles timeout", func(t *testing.T) {
			// ctx that expired in the past
			ctx, canc := context.WithDeadline(context.Background(), time.Now().Add(time.Second*-30))
			defer canc()
			_, err := svc.fetch(ctx, "")
			require.ErrorIs(t, err, context.DeadlineExceeded)
			require.False(t, gcom.httpCalls.called(), "gcom api should not be called")
			require.Empty(t, svc.ProvideDetectors(context.Background()))
		})

		t.Run("returns error if status code is outside 2xx range", func(t *testing.T) {
			errScenario := &gcomScenario{httpHandlerFunc: func(w http.ResponseWriter, req *http.Request) {
				// Return a valid json response so json.Unmarshal succeeds
				// but still return 500 status code
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte("[]"))
			}}
			errSrv := errScenario.newHTTPTestServer()
			t.Cleanup(errSrv.Close)
			svc := provideDynamic(t, errSrv.URL)
			_, err := svc.fetch(context.Background(), "")
			require.Error(t, err)
		})

		t.Run("etag", func(t *testing.T) {
			for _, tc := range []struct {
				name       string
				clientEtag string

				serverEtag string
				expError   error
			}{
				{name: "no client etag", clientEtag: "", serverEtag: "etag", expError: nil},
				{name: "no server etag", clientEtag: `"abcdef"`, serverEtag: "", expError: nil},
				{name: "client different etag than server", clientEtag: `"abcdef"`, serverEtag: "etag", expError: nil},
				{name: "same client and server etag returns errNotModified", clientEtag: `"etag"`, serverEtag: `"etag"`, expError: errNotModified},
			} {
				t.Run(tc.name, func(t *testing.T) {
					callback := make(chan struct{})
					gcom := newDefaultGCOMScenario(func(writer http.ResponseWriter, request *http.Request) {
						const headerIfNoneMatch = "If-None-Match"
						if tc.clientEtag == "" {
							require.Empty(t, request.Header.Values(headerIfNoneMatch))
						} else {
							require.Equal(t, tc.clientEtag, request.Header.Get(headerIfNoneMatch))
						}
						if tc.serverEtag != "" {
							writer.Header().Add("ETag", tc.serverEtag)
							if tc.serverEtag == tc.clientEtag {
								writer.WriteHeader(http.StatusNotModified)
							}
						}
						close(callback)
					})
					srv := gcom.newHTTPTestServer()
					t.Cleanup(srv.Close)
					svc := provideDynamic(t, srv.URL)

					_, err := svc.fetch(context.Background(), tc.clientEtag)
					if tc.expError != nil {
						require.ErrorIs(t, err, tc.expError)
					} else {
						require.NoError(t, err)
					}
					select {
					case <-callback:
						break
					case <-time.After(time.Second * 10):
						t.Fatal("timeout")
					}
					require.True(t, gcom.httpCalls.calledOnce(), "gcom api should be called")
				})
			}
		})
	})

	t.Run("updateDetectors", func(t *testing.T) {
		t.Run("successful", func(t *testing.T) {
			svc := provideDynamic(t, srv.URL)

			// Check that store is initially empty
			dbV, ok, err := svc.store.Get(context.Background())
			require.NoError(t, err)
			require.False(t, ok)
			require.Empty(t, dbV, "initial store should be empty")
			lastUpdated, err := svc.store.GetLastUpdated(context.Background())
			require.NoError(t, err)
			require.Zero(t, lastUpdated)

			// Also check in-memory detectors
			require.Empty(t, svc.ProvideDetectors(context.Background()))

			// Fetch and store value
			err = svc.updateDetectors(context.Background(), "")
			require.NoError(t, err)
			checkMockDetectors(t, svc)

			// Check that the value has been updated in the kv store, by reading from the store directly
			dbV, ok, err = svc.store.Get(context.Background())
			require.NoError(t, err)
			require.True(t, ok)
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

			svc := provideDynamic(t, srv.URL)

			// Set initial cached detectors
			svc.mux.Lock()
			svc.detectors = mockGCOMDetectors
			svc.mux.Unlock()

			// Set initial patterns store as well
			err = svc.store.Set(context.Background(), mockGCOMPatterns)
			require.NoError(t, err)

			// Try to update from GCOM, but it returns an error
			err = svc.updateDetectors(context.Background(), "")
			require.Error(t, err)
			require.True(t, scenario.httpCalls.calledOnce(), "gcom api should be called once")

			// Patterns in store should not be modified
			dbV, ok, err := svc.store.Get(context.Background())
			require.NoError(t, err)
			require.True(t, ok)
			require.NotEmpty(t, dbV)
			var newPatterns GCOMPatterns
			err = json.Unmarshal([]byte(dbV), &newPatterns)
			require.NoError(t, err)
			require.Equal(t, mockGCOMPatterns, newPatterns, "store should not be modified")

			// Same for in-memory detectors
			checkMockDetectors(t, svc)
		})

		t.Run("etag", func(t *testing.T) {
			const serverEtag = "hit"
			gcom := newEtagGCOMScenario(serverEtag)
			srv := gcom.newHTTPTestServer()
			t.Cleanup(srv.Close)

			t.Run("etag is saved in underlying store", func(t *testing.T) {
				svc := provideDynamic(t, srv.URL)

				err := svc.updateDetectors(context.Background(), "old")
				require.NoError(t, err)

				etag, ok, err := svc.store.GetETag(context.Background())
				require.NoError(t, err)
				require.True(t, ok)
				require.Equal(t, serverEtag, etag)

				lastUpdate, err := svc.store.GetLastUpdated(context.Background())
				require.NoError(t, err)
				require.WithinDuration(t, lastUpdate, time.Now(), time.Second*10)
			})

			t.Run("same etag does not modify underlying store", func(t *testing.T) {
				svc := provideDynamic(t, srv.URL)
				require.NoError(t, svc.updateDetectors(context.Background(), serverEtag))
				_, ok, err := svc.store.Get(context.Background())
				require.NoError(t, err)
				require.False(t, ok)
			})

			t.Run("different etag modified underlying store", func(t *testing.T) {
				svc := provideDynamic(t, srv.URL)
				require.NoError(t, svc.updateDetectors(context.Background(), "old"))
				_, ok, err := svc.store.Get(context.Background())
				require.NoError(t, err)
				require.True(t, ok)
			})
		})
	})

	t.Run("setDetectorsFromCache", func(t *testing.T) {
		t.Run("empty store doesn't return an error", func(t *testing.T) {
			svc := provideDynamic(t, srv.URL)

			err := svc.setDetectorsFromCache(context.Background())
			require.NoError(t, err)
			require.Empty(t, svc.ProvideDetectors(context.Background()))
		})

		t.Run("store is restored before returning the service", func(t *testing.T) {
			// Populate store
			store := angularpatternsstore.ProvideService(kvstore.NewFakeKVStore())
			err := store.Set(context.Background(), mockGCOMPatterns)
			require.NoError(t, err)

			svc := provideDynamic(t, srv.URL, provideDynamicOpts{
				store: store,
			})

			// Restore
			detectors := svc.ProvideDetectors(context.Background())
			require.Equal(t, mockGCOMDetectors, detectors)
		})
	})
}

func TestDynamicAngularDetectorsProviderCloudVsOnPrem(t *testing.T) {
	gcom := newDefaultGCOMScenario()
	srv := gcom.newHTTPTestServer()
	t.Cleanup(srv.Close)

	t.Run("should use cloud interval if stack_id is set", func(t *testing.T) {
		svc := provideDynamic(t, srv.URL, provideDynamicOpts{cfg: &setting.Cfg{StackID: "1234"}})
		require.Equal(t, backgroundJobIntervalCloud, svc.backgroundJobInterval)
	})

	t.Run("should use on-prem interval if stack_id is not set", func(t *testing.T) {
		svc := provideDynamic(t, srv.URL, provideDynamicOpts{cfg: &setting.Cfg{StackID: ""}})
		require.Equal(t, backgroundJobIntervalOnPrem, svc.backgroundJobInterval)
	})
}

func TestDynamicAngularDetectorsProviderBackgroundService(t *testing.T) {
	mockGCOMPatterns := newMockGCOMPatterns()
	gcom := newDefaultGCOMScenario()
	srv := gcom.newHTTPTestServer()
	t.Cleanup(srv.Close)

	t.Run("background service", func(t *testing.T) {
		oldBackgroundJobInterval := backgroundJobIntervalOnPrem
		backgroundJobIntervalOnPrem = 10 * time.Millisecond
		t.Cleanup(func() {
			backgroundJobIntervalOnPrem = oldBackgroundJobInterval
		})

		t.Run("fetches value from gcom on start if too much time has passed", func(t *testing.T) {
			gcomCallback := make(chan struct{})
			gcom := newDefaultGCOMScenario(func(_ http.ResponseWriter, _ *http.Request) {
				gcomCallback <- struct{}{}
			})
			srv := gcom.newHTTPTestServer()
			svc := provideDynamic(t, srv.URL)
			mockStore := &mockLastUpdatePatternsStore{
				Service: svc.store,
				// Expire cache
				lastUpdated: time.Now().Add(time.Hour * -24),
			}
			svc.store = mockStore

			// Store mock GCOM patterns
			err := mockStore.Set(context.Background(), mockGCOMPatterns)
			require.NoError(t, err)

			// Ensure the detectors are initially empty
			require.Empty(t, svc.ProvideDetectors(context.Background()))

			// Start bg service and it should call GCOM immediately
			bg := newBackgroundServiceScenario(svc)
			t.Cleanup(bg.close)
			bg.run(context.Background())

			// Await job call with timeout
			select {
			case <-time.After(time.Second * 10):
				t.Fatal("timeout")
			case <-gcomCallback:
				break
			}
			require.True(t, gcom.httpCalls.calledOnce(), "gcom api should be called once")

			// Check new cached value
			checkMockDetectors(t, svc)
			bg.exitAndWait()
		})

		t.Run("runs the job periodically", func(t *testing.T) {
			const tcRuns = 3

			lastJobTime := time.Now()
			var jobCalls counter
			const jobInterval = time.Millisecond * 20
			done := make(chan struct{})
			gcom := newDefaultGCOMScenario(func(_ http.ResponseWriter, _ *http.Request) {
				now := time.Now()
				assert.WithinDuration(t, now, lastJobTime, jobInterval*2)
				lastJobTime = now

				jobCalls.inc()
				if jobCalls.calls() == tcRuns {
					// this is done ONLY once
					done <- struct{}{}
					close(done)
				}
			})
			srv := gcom.newHTTPTestServer()
			t.Cleanup(srv.Close)
			svc := provideDynamic(t, srv.URL)

			bg := newBackgroundServiceScenario(svc)
			t.Cleanup(bg.close)
			// Refresh cache right before running the service, so we skip the initial run
			require.NoError(t, svc.store.Set(context.Background(), mockGCOMPatterns))
			bg.run(context.Background())
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

		t.Run("IsDisabled", func(t *testing.T) {
			for _, tc := range []struct {
				name                  string
				checkForPluginUpdates bool
				expIsDisabled         bool
			}{
				{name: "true", checkForPluginUpdates: true, expIsDisabled: false},
				{name: "false", checkForPluginUpdates: false, expIsDisabled: true},
			} {
				t.Run(tc.name, func(t *testing.T) {
					cfg := setting.NewCfg()
					cfg.CheckForPluginUpdates = tc.checkForPluginUpdates
					svc := provideDynamic(t, srv.URL, provideDynamicOpts{cfg: cfg})
					require.Equal(t, tc.expIsDisabled, svc.IsDisabled(), "IsDisabled should return correct value")
				})
			}
		})
	})
}

func TestRandomSkew(t *testing.T) {
	const runs = 100

	gcom := newDefaultGCOMScenario()
	srv := gcom.newHTTPTestServer()
	t.Cleanup(srv.Close)
	svc := provideDynamic(t, srv.URL)
	const ttl = time.Hour * 1
	const skew = ttl / 4
	var different bool
	var previous time.Duration
	for i := 0; i < runs; i++ {
		v := svc.randomSkew(skew)
		require.True(t, v >= 0 && v <= skew, "returned skew must be within ttl and +ttl/4")
		if i == 0 {
			previous = v
		} else if !different {
			different = float64(previous) != float64(v)
		}
	}
	require.True(t, different, "must not always return the same value")
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

func checkMockDetectorsSlice(t *testing.T, detectors []angulardetector.AngularDetector) {
	require.Len(t, detectors, 2)
	d, ok := detectors[0].(*angulardetector.ContainsBytesDetector)
	require.True(t, ok)
	require.Equal(t, []byte(`PanelCtrl`), d.Pattern)
	rd, ok := detectors[1].(*angulardetector.RegexDetector)
	require.True(t, ok)
	require.Equal(t, `["']QueryCtrl["']`, rd.Regex.String())
}

func checkMockDetectors(t *testing.T, d *Dynamic) {
	checkMockDetectorsSlice(t, d.ProvideDetectors(context.Background()))
}

func newMockGCOMPatterns() GCOMPatterns {
	var mockGCOMPatterns GCOMPatterns
	if err := json.Unmarshal(mockGCOMResponse, &mockGCOMPatterns); err != nil {
		panic(err)
	}
	return mockGCOMPatterns
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

func newEtagGCOMScenario(etag string) *gcomScenario {
	return &gcomScenario{httpHandlerFunc: func(w http.ResponseWriter, req *http.Request) {
		if req.Header.Get("If-None-Match") == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Add("ETag", etag)
		mockGCOMHTTPHandlerFunc(w, req)
	}}
}

func newDefaultGCOMScenario(middlewares ...http.HandlerFunc) *gcomScenario {
	return &gcomScenario{httpHandlerFunc: func(w http.ResponseWriter, req *http.Request) {
		for _, f := range middlewares {
			f(w, req)
		}
		mockGCOMHTTPHandlerFunc(w, req)
	}}
}

func newError500GCOMScenario() *gcomScenario {
	return &gcomScenario{httpHandlerFunc: func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}}
}

type provideDynamicOpts struct {
	store angularpatternsstore.Service
	cfg   *setting.Cfg
}

func provideDynamic(t *testing.T, gcomURL string, opts ...provideDynamicOpts) *Dynamic {
	if len(opts) == 0 {
		opts = []provideDynamicOpts{{}}
	}
	opt := opts[0]
	if opt.store == nil {
		opt.store = angularpatternsstore.ProvideService(kvstore.NewFakeKVStore())
	}
	if opt.cfg == nil {
		opt.cfg = setting.NewCfg()
	}
	opt.cfg.GrafanaComAPIURL = gcomURL + "/api"
	d, err := ProvideDynamic(opt.cfg, opt.store)
	require.NoError(t, err)
	return d
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
	wg          sync.WaitGroup
	ctxCancFunc context.CancelFunc
}

func newBackgroundServiceScenario(svc *Dynamic) *backgroundServiceScenario {
	return &backgroundServiceScenario{
		svc: svc,
	}
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

func (s *backgroundServiceScenario) run(ctx context.Context) {
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
	}()
}
