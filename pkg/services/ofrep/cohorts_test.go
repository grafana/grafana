package ofrep

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func cohortTestResolver(t *testing.T, handler http.HandlerFunc) *cohortResolver {
	t.Helper()
	server := httptest.NewTLSServer(handler)
	t.Cleanup(server.Close)
	tokenFile := filepath.Join(t.TempDir(), "token")
	require.NoError(t, os.WriteFile(tokenFile, []byte("test-token"), 0600))
	b := &APIBuilder{}
	require.NoError(t, b.EnableCohortEnrichment(CohortConfig{URL: server.URL, TokenFile: tokenFile, AllowedNamespaces: []string{"stacks-1", "stacks-2", "stacks-3"}, Timeout: time.Second, CacheTTL: time.Minute, MaxSnapshotAge: 2 * time.Hour, MaxEntries: 2, MaxConcurrent: 2}, prometheus.NewRegistry()))
	b.cohorts.client = server.Client()
	return b.cohorts
}

func cohortResponse(w http.ResponseWriter, r *http.Request, now time.Time) {
	w.Header().Set("Content-Type", "application/json")
	switch r.URL.Path {
	case "/instances/1", "/instances/2":
		_, _ = io.WriteString(w, `{"orgId":10}`)
	case "/instances/3":
		_, _ = io.WriteString(w, `{"orgId":20}`)
	case "/growth/cohorts/10":
		_, _ = fmt.Fprintf(w, `{"cohorts":["preview"],"snapshot":{"version":"v1","refreshedAt":%q}}`, now.Format(time.RFC3339Nano))
	case "/growth/cohorts/20":
		_, _ = fmt.Fprintf(w, `{"cohorts":[],"snapshot":{"version":"v1","refreshedAt":%q}}`, now.Format(time.RFC3339Nano))
	default:
		http.NotFound(w, r)
	}
}

func cohortRequest(namespace string, identityType types.IdentityType, bulk bool) *http.Request {
	r := httptest.NewRequest(http.MethodPost, ofrepPath, bytes.NewBufferString(`{"context":{"targetingKey":"stacks-fixture","gcomOrgID":"999","growthCohorts":["spoof"],"growthCohortsAvailable":true,"growthCohortsVersion":"spoof","growthCohortsRefreshedAt":"spoof","unrelated":9007199254740993}}`))
	r.Header.Set("Content-Type", "application/json")
	if !bulk {
		r = mux.SetURLVars(r, map[string]string{"flagKey": "cohort-demo.participation"})
	}
	return r.WithContext(types.WithAuthInfo(r.Context(), &identity.StaticRequester{Namespace: namespace, Type: identityType}))
}

func TestCohortEnrichmentServingBoundary(t *testing.T) {
	var calls atomic.Int32
	now := time.Now()
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-token" {
			http.Error(w, "unauthorized", 401)
			return
		}
		calls.Add(1)
		cohortResponse(w, r, now)
	})
	captured := make(chan map[string]json.RawMessage, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Context map[string]json.RawMessage `json:"context"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		captured <- body.Context
		_, _ = io.WriteString(w, `{"flags":[],"key":"cohort-demo.participation","value":true,"metadata":{"public":"true"}}`)
	}))
	defer upstream.Close()
	b := newTestBuilder(t, upstream.URL)
	b.cohorts = resolver
	for _, bulk := range []bool{false, true} {
		for _, tt := range []struct {
			ns           string
			typ          types.IdentityType
			known        bool
			org, cohorts string
		}{
			{"stacks-1", types.TypeUser, true, `"10"`, `["preview"]`},
			{"stacks-2", types.TypeUser, true, `"10"`, `["preview"]`},
			{"stacks-3", types.TypeUser, true, `"20"`, `[]`},
			{"stacks-4", types.TypeUser, false, `"999"`, `[]`},
			{"stacks-1", types.TypeUnauthenticated, false, `"999"`, `[]`},
			{"stacks-1", types.TypeEmpty, false, `"999"`, `[]`},
			{"*", types.TypeUser, false, `"999"`, `[]`},
		} {
			w := httptest.NewRecorder()
			req := cohortRequest(tt.ns, tt.typ, bulk)
			if bulk {
				b.allFlagsHandler(w, req)
			} else {
				b.oneFlagHandler(w, req)
			}
			require.Equal(t, 200, w.Code, w.Body.String())
			attrs := <-captured
			require.Equal(t, fmt.Sprint(tt.known), string(attrs["growthCohortsAvailable"]))
			require.JSONEq(t, tt.cohorts, string(attrs["growthCohorts"]))
			require.Equal(t, tt.org, string(attrs["gcomOrgID"]))
			require.Equal(t, "9007199254740993", string(attrs["unrelated"]))
			if !tt.known {
				require.NotContains(t, attrs, "growthCohortsVersion")
				require.NotContains(t, attrs, "growthCohortsRefreshedAt")
			}
		}
	}
	require.EqualValues(t, 12, calls.Load()) // Three stacks, two requests each, across two passes through a two-entry cache.
}

func TestCohortCacheRefreshFailureAndRecovery(t *testing.T) {
	now := time.Now()
	clock := now
	var calls atomic.Int32
	var fail atomic.Bool
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if fail.Load() {
			http.Error(w, "unavailable", 503)
			return
		}
		cohortResponse(w, r, now)
	})
	resolver.now = func() time.Time { return clock }
	first := resolver.resolve(context.Background(), "stacks-1")
	require.True(t, resolver.fresh(first))
	require.Equal(t, first, resolver.resolve(context.Background(), "stacks-1"))
	require.EqualValues(t, 2, calls.Load())
	fail.Store(true)
	clock = clock.Add(time.Minute)
	require.False(t, resolver.fresh(resolver.resolve(context.Background(), "stacks-1")))
	require.False(t, resolver.fresh(resolver.resolve(context.Background(), "stacks-1")))
	require.EqualValues(t, 3, calls.Load())
	fail.Store(false)
	clock = clock.Add(time.Second)
	require.True(t, resolver.fresh(resolver.resolve(context.Background(), "stacks-1")))
	require.EqualValues(t, 5, calls.Load())
	clock = clock.Add(3 * time.Hour)
	require.False(t, resolver.fresh(resolver.resolve(context.Background(), "stacks-1")))
}

func TestCohortUnavailableDoesNotBreakOrdinaryFlags(t *testing.T) {
	for _, response := range []string{
		`{"cohorts":[],"snapshot":null}`,
		`{"cohorts":[],"snapshot":{"version":"v1","refreshedAt":"2000-01-01T00:00:00Z"}}`,
		`{"cohorts":[],"snapshot":{"version":"v1","refreshedAt":"2100-01-01T00:00:00Z"}}`,
		`{"cohorts":null,"snapshot":null}`, `invalid`,
	} {
		t.Run(response, func(t *testing.T) {
			resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/instances/1" {
					_, _ = io.WriteString(w, `{"orgId":10}`)
					return
				}
				_, _ = io.WriteString(w, response)
			})
			b := &APIBuilder{cohorts: resolver}
			req := cohortRequest("stacks-1", types.TypeUser, false)
			require.NoError(t, b.enrichCohorts(req))
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			require.Contains(t, string(body), `"growthCohortsAvailable":false`)
			require.Contains(t, string(body), `"unrelated":9007199254740993`)
		})
	}
}

func TestCohortLookupCoalescingAndBounds(t *testing.T) {
	var calls atomic.Int32
	started := make(chan struct{}, 1)
	release := make(chan struct{})
	now := time.Now()
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path == "/instances/1" {
			select {
			case started <- struct{}{}:
			default:
			}
			<-release
		}
		cohortResponse(w, r, now)
	})
	resolver.config.Timeout = time.Second
	var wg sync.WaitGroup
	for range 20 {
		wg.Go(func() { resolver.resolve(context.Background(), "stacks-1") })
	}
	<-started
	close(release)
	wg.Wait()
	require.EqualValues(t, 2, calls.Load())
	for _, ns := range []string{"stacks-2", "stacks-3"} {
		resolver.resolve(context.Background(), ns)
	}
	require.Len(t, resolver.cache, 2)
	require.NotContains(t, resolver.cache, "stacks-1")
	require.Empty(t, resolver.inflight)
	require.Empty(t, resolver.slots)
}

func TestCohortLookupTimeout(t *testing.T) {
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) { <-r.Context().Done() })
	resolver.config.Timeout = 20 * time.Millisecond
	start := time.Now()
	require.False(t, resolver.fresh(resolver.resolve(context.Background(), "stacks-1")))
	require.Less(t, time.Since(start), time.Second)
}

func TestCohortDisabledScrubsReservedAttributes(t *testing.T) {
	b := &APIBuilder{}
	req := cohortRequest("stacks-1", types.TypeUser, false)
	require.NoError(t, b.enrichCohorts(req))
	data, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	require.NotContains(t, string(data), "spoof")
	require.Contains(t, string(data), `"growthCohortsAvailable":false`)
}

// This opt-in integration test uses the deployment_tools cohort-targeting fixture and pinned GOFF relay.
func TestCohortRealGOFF(t *testing.T) {
	endpoint := os.Getenv("GOFF_COHORT_TEST_URL")
	if endpoint == "" {
		t.Skip("set GOFF_COHORT_TEST_URL to a relay serving the cohort-targeting fixture")
	}
	now := time.Now()
	clock := now
	var mode atomic.Int32
	mode.Store(1)
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
		switch mode.Load() {
		case -1:
			http.Error(w, "unavailable", 503)
			return
		case 0:
			if r.URL.Path == "/growth/cohorts/10" {
				_, _ = fmt.Fprintf(w, `{"cohorts":[],"snapshot":{"version":"v2","refreshedAt":%q}}`, now.Format(time.RFC3339Nano))
				return
			}
		}
		cohortResponse(w, r, now)
	})
	resolver.now = func() time.Time { return clock }
	b := newTestBuilder(t, endpoint)
	b.cohorts = resolver
	for _, phase := range []struct {
		name string
		mode int32
	}{{"member", 1}, {"removed", 0}, {"lookup failure", -1}, {"recovery", 1}} {
		t.Run(phase.name, func(t *testing.T) {
			mode.Store(phase.mode)
			clock = clock.Add(time.Minute)
			for _, ns := range []string{"stacks-1", "stacks-2", "stacks-3"} {
				w := httptest.NewRecorder()
				b.allFlagsHandler(w, cohortRequest(ns, types.TypeUser, true))
				require.Equal(t, 200, w.Code, w.Body.String())
				var response struct {
					Flags []struct {
						Key       string         `json:"key"`
						Value     bool           `json:"value"`
						ErrorCode string         `json:"errorCode"`
						Metadata  map[string]any `json:"metadata"`
					} `json:"flags"`
				}
				require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
				found := 0
				for _, flag := range response.Flags {
					switch flag.Key {
					case "cohort-demo.participation", "cohort-demo.arm":
						found++
						require.Empty(t, flag.ErrorCode)
						if flag.Key == "cohort-demo.participation" {
							require.Equal(t, phase.mode == 1 && ns != "stacks-3", flag.Value)
						} else if phase.mode == 1 && ns != "stacks-3" {
							require.True(t, flag.Value)
						}
						require.Equal(t, "demo-v1", flag.Metadata["experimentRevision"])
					case "ordinary":
						found++
						require.Empty(t, flag.ErrorCode)
						require.True(t, flag.Value)
					}
				}
				require.Equal(t, 3, found)
			}
		})
	}
}

func TestCohortRejectsUnsafeConfiguration(t *testing.T) {
	b := &APIBuilder{}
	require.NoError(t, b.EnableCohortEnrichment(CohortConfig{}, nil))
	require.Error(t, b.EnableCohortEnrichment(CohortConfig{AllowedNamespaces: []string{"stacks-1"}, URL: "http://example.com"}, nil))
	for _, ns := range []string{"*", "stacks-0", "stacks-01", "stacks-1/2", "orgs-1"} {
		_, ok := cohortStackID(ns)
		require.False(t, ok)
	}
	u, _ := url.Parse("https://example.com")
	require.NotNil(t, newCohortResolver(CohortConfig{MaxConcurrent: 1}, u))
}

func TestCohortEnrichmentBeforeUpstreamSelection(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagFeaturesLegacyOverrideLookupBypass, true)
	var direct, legacy atomic.Int32
	server := func(counter *atomic.Int32) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				Context struct {
					Available bool   `json:"growthCohortsAvailable"`
					OrgID     string `json:"gcomOrgID"`
				} `json:"context"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !body.Context.Available || body.Context.OrgID != "10" {
				http.Error(w, "not enriched", 500)
				return
			}
			counter.Add(1)
			_, _ = io.WriteString(w, `{"flags":[],"key":"flag","value":true}`)
		}))
	}
	goff, hg := server(&direct), server(&legacy)
	defer goff.Close()
	defer hg.Close()
	b := newTestBuilder(t, hg.URL)
	b.EnableLegacyOverrideLookupBypass(mustParseURL(t, goff.URL), []string{"overridden"})
	b.cohorts = cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) { cohortResponse(w, r, time.Now()) })
	for _, key := range []string{"cohort-demo.participation", "overridden", ""} {
		req := cohortRequest("stacks-1", types.TypeUser, key == "")
		w := httptest.NewRecorder()
		if key == "" {
			b.allFlagsHandler(w, req)
		} else {
			req = mux.SetURLVars(req, map[string]string{"flagKey": key})
			b.oneFlagHandler(w, req)
		}
		require.Equal(t, 200, w.Code, w.Body.String())
	}
	require.EqualValues(t, 1, direct.Load())
	require.EqualValues(t, 2, legacy.Load())
}
