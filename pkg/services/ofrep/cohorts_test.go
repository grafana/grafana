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
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func cohortTokenFile(t *testing.T) string {
	t.Helper()
	tokenFile := filepath.Join(t.TempDir(), "token")
	require.NoError(t, os.WriteFile(tokenFile, []byte("test-token"), 0600))
	return tokenFile
}

func cohortTestConfig(t *testing.T, url string) CohortConfig {
	return CohortConfig{URL: url, TokenFile: cohortTokenFile(t), AllowedNamespaces: []string{"stacks-1", "stacks-2", "stacks-3"}, Timeout: time.Second, CacheTTL: time.Minute, MaxSnapshotAge: 2 * time.Hour, MaxConcurrent: 2}
}

func cohortTestResolver(t *testing.T, handler http.HandlerFunc, opts ...func(*CohortConfig)) *cohortResolver {
	t.Helper()
	server := httptest.NewTLSServer(handler)
	t.Cleanup(server.Close)
	c := cohortTestConfig(t, server.URL)
	for _, opt := range opts {
		opt(&c)
	}
	b := &APIBuilder{}
	require.NoError(t, b.EnableCohortEnrichment(c, prometheus.NewRegistry()))
	b.cohorts.client.Transport.(*http.Transport).TLSClientConfig = server.Client().Transport.(*http.Transport).TLSClientConfig
	return b.cohorts
}

// cohortClock replaces the resolver clock; refreshes read it from their own goroutines.
func cohortClock(r *cohortResolver, start time.Time) func(time.Duration) {
	var ns atomic.Int64
	ns.Store(start.UnixNano())
	r.now = func() time.Time { return time.Unix(0, ns.Load()) }
	return func(d time.Duration) { ns.Add(int64(d)) }
}

func requireOutcome(t *testing.T, r *cohortResolver, outcome, reason string, want float64) {
	t.Helper()
	require.Equal(t, want, testutil.ToFloat64(r.outcomes.WithLabelValues(outcome, reason)), "%s/%s", outcome, reason)
}

func withCohorts(b *APIBuilder, resolver *cohortResolver) *APIBuilder {
	b.cohorts = resolver
	b.scrubCohorts = true
	return b
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
			http.Error(w, "unauthorized", http.StatusUnauthorized)
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
	b := withCohorts(newTestBuilder(t, upstream.URL), resolver)
	for _, bulk := range []bool{false, true} {
		for _, tt := range []struct {
			ns           string
			typ          types.IdentityType
			known        bool
			org, cohorts string
		}{
			{"stacks-1", types.TypeUser, true, `"10"`, `["preview"]`},
			{"stacks-1", types.TypeServiceAccount, true, `"10"`, `["preview"]`},
			{"stacks-1", types.TypeAccessPolicy, true, `"10"`, `["preview"]`},
			{"stacks-2", types.TypeUser, true, `"10"`, `["preview"]`},
			{"stacks-3", types.TypeUser, true, `"20"`, `[]`},
			{"stacks-4", types.TypeUser, false, `"999"`, `[]`},
			{"stacks-1", types.TypeUnauthenticated, false, `"999"`, `[]`},
			{"stacks-1", types.TypeEmpty, false, `"999"`, `[]`},
			{"stacks-1", types.TypeAnonymous, false, `"999"`, `[]`},
			{"stacks-1", types.TypePublic, false, `"999"`, `[]`},
			{"stacks-1", types.TypeRenderService, false, `"999"`, `[]`},
			{"stacks-1", types.TypeProvisioning, false, `"999"`, `[]`},
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
	// Three stack mappings and two organization memberships; every later request is a cache hit.
	require.EqualValues(t, 5, calls.Load())
	requireOutcome(t, resolver, "lookup_success", "none", 3)
	requireOutcome(t, resolver, "cache_hit", "none", 7)
}

func TestCohortCacheRefreshFailureAndRecovery(t *testing.T) {
	now := time.Now()
	var calls atomic.Int32
	var fail atomic.Bool
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if fail.Load() {
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
			return
		}
		cohortResponse(w, r, now)
	})
	advance := cohortClock(resolver, now)
	first, status := resolver.resolve(context.Background(), "stacks-1")
	require.True(t, resolver.fresh(first))
	require.Equal(t, cohortStatus{"lookup_success", "none"}, status)
	second, status := resolver.resolve(context.Background(), "stacks-1")
	require.Equal(t, first, second)
	require.Equal(t, cohortStatus{"cache_hit", "none"}, status)
	require.EqualValues(t, 2, calls.Load())

	// Stale-while-error: the last good membership keeps serving, with at most one retry per second.
	fail.Store(true)
	advance(time.Minute)
	for range 3 {
		value, status := resolver.resolve(context.Background(), "stacks-1")
		require.True(t, resolver.fresh(value))
		require.Equal(t, first, value)
		require.Equal(t, cohortStatus{"stale", "upstream_5xx"}, status)
	}
	require.EqualValues(t, 3, calls.Load())
	advance(time.Second)
	_, status = resolver.resolve(context.Background(), "stacks-1")
	require.Equal(t, cohortStatus{"stale", "upstream_5xx"}, status)
	require.EqualValues(t, 4, calls.Load())

	fail.Store(false)
	advance(time.Second)
	value, status := resolver.resolve(context.Background(), "stacks-1")
	require.True(t, resolver.fresh(value))
	require.Equal(t, cohortStatus{"lookup_success", "none"}, status)
	require.EqualValues(t, 5, calls.Load())

	// Stale values stop enrolling once the snapshot is older than MaxSnapshotAge.
	fail.Store(true)
	advance(3 * time.Hour)
	value, status = resolver.resolve(context.Background(), "stacks-1")
	require.False(t, resolver.fresh(value))
	require.Equal(t, cohortStatus{"stale", "upstream_5xx"}, status)
	req := cohortRequest("stacks-1", types.TypeUser, false)
	require.NoError(t, withCohorts(&APIBuilder{}, resolver).enrichCohorts(req))
	data, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	require.Contains(t, string(data), `"growthCohortsAvailable":false`)
	requireOutcome(t, resolver, "unavailable", "upstream_5xx", 1)
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
			b := withCohorts(&APIBuilder{}, resolver)
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
	require.EqualValues(t, 5, calls.Load())
	require.Len(t, resolver.orgs, 3)
	require.Len(t, resolver.memberships, 2)
	for _, e := range resolver.orgs {
		require.Nil(t, e.done)
	}
	require.Empty(t, resolver.slots)
}

func TestCohortStacksShareOrganizationSnapshot(t *testing.T) {
	now := time.Now()
	var version atomic.Value
	version.Store("v1")
	var membershipCalls atomic.Int32
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/growth/cohorts/10" {
			membershipCalls.Add(1)
			_, _ = fmt.Fprintf(w, `{"cohorts":["preview"],"snapshot":{"version":%q,"refreshedAt":%q}}`, version.Load(), now.Format(time.RFC3339Nano))
			return
		}
		cohortResponse(w, r, now)
	})
	advance := cohortClock(resolver, now)
	one, _ := resolver.resolve(context.Background(), "stacks-1")
	two, _ := resolver.resolve(context.Background(), "stacks-2")
	require.Equal(t, one, two)
	require.EqualValues(t, 1, membershipCalls.Load())

	version.Store("v2")
	advance(2 * time.Minute)
	two, _ = resolver.resolve(context.Background(), "stacks-2")
	one, status := resolver.resolve(context.Background(), "stacks-1")
	require.Equal(t, "v2", two.Snapshot.Version)
	require.Equal(t, two, one)
	require.Equal(t, cohortStatus{"cache_hit", "none"}, status)
	require.EqualValues(t, 2, membershipCalls.Load())
}

func TestCohortStaleOrganizationMapping(t *testing.T) {
	now := time.Now()
	var instancesDown atomic.Bool
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
		if instancesDown.Load() && r.URL.Path == "/instances/1" {
			http.Error(w, "unavailable", http.StatusBadGateway)
			return
		}
		cohortResponse(w, r, now)
	})
	advance := cohortClock(resolver, now)
	_, status := resolver.resolve(context.Background(), "stacks-1")
	require.Equal(t, "lookup_success", status.outcome)
	instancesDown.Store(true)
	advance(cohortOrgTTL + time.Second)
	value, status := resolver.resolve(context.Background(), "stacks-1")
	require.Equal(t, cohortStatus{"stale", "upstream_5xx"}, status)
	require.Equal(t, "10", value.orgID)
	require.True(t, resolver.fresh(value))
}

func TestCohortLeaderCancellationDoesNotPoisonCache(t *testing.T) {
	now := time.Now()
	var calls atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path == "/instances/1" {
			close(started)
			<-release
		}
		cohortResponse(w, r, now)
	})
	ctx, cancel := context.WithCancel(context.Background())
	leader := make(chan cohortStatus)
	go func() {
		_, status := resolver.resolve(ctx, "stacks-1")
		leader <- status
	}()
	<-started
	waiter := make(chan cohortSnapshot)
	go func() {
		value, _ := resolver.resolve(context.Background(), "stacks-1")
		waiter <- value
	}()
	cancel()
	require.Equal(t, cohortStatus{"unavailable", "timeout"}, <-leader)
	close(release)
	require.True(t, resolver.fresh(<-waiter))
	value, status := resolver.resolve(context.Background(), "stacks-1")
	require.True(t, resolver.fresh(value))
	require.Equal(t, cohortStatus{"cache_hit", "none"}, status)
	require.EqualValues(t, 2, calls.Load())
}

func TestCohortLookupSaturation(t *testing.T) {
	now := time.Now()
	var calls atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path == "/instances/1" {
			close(started)
			<-release
		}
		cohortResponse(w, r, now)
	}, func(c *CohortConfig) { c.MaxConcurrent = 1 })
	first := make(chan cohortSnapshot)
	go func() {
		value, _ := resolver.resolve(context.Background(), "stacks-1")
		first <- value
	}()
	<-started
	_, status := resolver.resolve(context.Background(), "stacks-3")
	require.Equal(t, cohortStatus{"unavailable", "saturated"}, status)
	close(release)
	require.True(t, resolver.fresh(<-first))
	require.EqualValues(t, 2, calls.Load())
	value, status := resolver.resolve(context.Background(), "stacks-3")
	require.True(t, resolver.fresh(value))
	require.Equal(t, cohortStatus{"lookup_success", "none"}, status)
}
func TestCohortLookupTimeout(t *testing.T) {
	resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) { <-r.Context().Done() })
	resolver.config.Timeout = 20 * time.Millisecond
	start := time.Now()
	value, status := resolver.resolve(context.Background(), "stacks-1")
	require.False(t, resolver.fresh(value))
	require.Equal(t, cohortStatus{"unavailable", "timeout"}, status)
	require.Less(t, time.Since(start), time.Second)
}

func TestCohortLookupFailureReasons(t *testing.T) {
	now := time.Now().Format(time.RFC3339Nano)
	big := `{"cohorts":["` + strings.Repeat("a", mib) + `"]}`
	many := `{"cohorts":["x"` + strings.Repeat(`,"x"`, 1000) + `],"snapshot":{"version":"v1","refreshedAt":"` + now + `"}}`
	for _, tt := range []struct {
		name, instance, membership string
		status                     int
		reason                     string
	}{
		{"unauthorized", "", "", http.StatusUnauthorized, "auth"},
		{"forbidden", "", "", http.StatusForbidden, "auth"},
		{"not found", "", "", http.StatusNotFound, "not_found"},
		{"server error", "", "", http.StatusInternalServerError, "upstream_5xx"},
		{"bad gateway", "", "", http.StatusBadGateway, "upstream_5xx"},
		{"other status", "", "", http.StatusTeapot, "upstream_status"},
		{"org missing", `{}`, "", 0, "invalid"},
		{"org zero", `{"orgId":0}`, "", 0, "invalid"},
		{"org string", `{"orgId":"10"}`, "", 0, "decode"},
		{"org invalid json", `{`, "", 0, "decode"},
		{"body over 1 MiB", `{"orgId":10}`, big, 0, "invalid"},
		{"too many cohorts", `{"orgId":10}`, many, 0, "invalid"},
		{"name too long", `{"orgId":10}`, `{"cohorts":["` + strings.Repeat("a", 257) + `"]}`, 0, "invalid"},
		{"empty name", `{"orgId":10}`, `{"cohorts":[""]}`, 0, "invalid"},
		{"null cohorts", `{"orgId":10}`, `{"cohorts":null}`, 0, "invalid"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
				if tt.status != 0 {
					http.Error(w, "error", tt.status)
					return
				}
				if strings.HasPrefix(r.URL.Path, "/instances/") {
					_, _ = io.WriteString(w, tt.instance)
					return
				}
				_, _ = io.WriteString(w, tt.membership)
			})
			req := cohortRequest("stacks-1", types.TypeUser, false)
			require.NoError(t, withCohorts(&APIBuilder{}, resolver).enrichCohorts(req))
			data, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			require.Contains(t, string(data), `"growthCohortsAvailable":false`)
			requireOutcome(t, resolver, "unavailable", tt.reason, 1)
		})
	}

	t.Run("boundary sizes accepted", func(t *testing.T) {
		names := make([]string, 1000)
		for i := range names {
			names[i] = strings.Repeat("a", 256)
		}
		encoded, err := json.Marshal(names)
		require.NoError(t, err)
		resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/instances/") {
				_, _ = io.WriteString(w, `{"orgId":10}`)
				return
			}
			_, _ = fmt.Fprintf(w, `{"cohorts":%s,"snapshot":{"version":"v1","refreshedAt":%q,"sourceRefreshedAt":%q}}`, encoded, now, now)
		})
		value, status := resolver.resolve(context.Background(), "stacks-1")
		require.True(t, resolver.fresh(value))
		require.Len(t, value.Cohorts, 1000)
		require.Equal(t, cohortStatus{"lookup_success", "none"}, status)
	})

	t.Run("token file", func(t *testing.T) {
		resolver := cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) { cohortResponse(w, r, time.Now()) })
		require.NoError(t, os.WriteFile(resolver.config.TokenFile, []byte("\n"), 0600))
		_, status := resolver.resolve(context.Background(), "stacks-1")
		require.Equal(t, cohortStatus{"unavailable", "token_file"}, status)
	})
}
func TestCohortScrubOnlyAfterEnable(t *testing.T) {
	b := &APIBuilder{}
	req := cohortRequest("stacks-1", types.TypeUser, false)
	require.NoError(t, b.enrichCohorts(req))
	data, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	require.Contains(t, string(data), "spoof", "OSS must forward bodies untouched")

	require.NoError(t, b.EnableCohortEnrichment(CohortConfig{}, nil))
	require.Nil(t, b.cohorts)
	req = cohortRequest("stacks-1", types.TypeUser, false)
	require.NoError(t, b.enrichCohorts(req))
	data, err = io.ReadAll(req.Body)
	require.NoError(t, err)
	require.NotContains(t, string(data), "spoof")
	require.Contains(t, string(data), `"growthCohortsAvailable":false`)
}

func TestCohortScrubHandlesKeyCasing(t *testing.T) {
	b := withCohorts(&APIBuilder{}, nil)
	for _, body := range []string{
		`{"Context":{"growthCohortsAvailable":true}}`,
		`{"context":{},"CONTEXT":{"growthCohortsAvailable":true}}`,
		`{"cOnTeXt":{}}`,
	} {
		req := httptest.NewRequest(http.MethodPost, ofrepPath, bytes.NewBufferString(body))
		require.Error(t, b.enrichCohorts(req), body)
	}

	req := httptest.NewRequest(http.MethodPost, ofrepPath, bytes.NewBufferString(`{"context":{"GrowthCohortsAvailable":true,"growthcohorts":["spoof"],"GROWTHCOHORTSVERSION":"spoof","growthCohortsRefreshedat":"spoof","kept":1}}`))
	require.NoError(t, b.enrichCohorts(req))
	var got struct {
		Context map[string]json.RawMessage `json:"context"`
	}
	require.NoError(t, json.NewDecoder(req.Body).Decode(&got))
	require.Equal(t, map[string]json.RawMessage{
		"growthCohorts":          json.RawMessage(`[]`),
		"growthCohortsAvailable": json.RawMessage(`false`),
		"kept":                   json.RawMessage(`1`),
	}, got.Context)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("a rejected body must not be forwarded")
	}))
	defer upstream.Close()
	b = withCohorts(newTestBuilder(t, upstream.URL), nil)
	for _, bulk := range []bool{false, true} {
		req := httptest.NewRequest(http.MethodPost, ofrepPath, bytes.NewBufferString(`{"Context":{"growthCohortsAvailable":true}}`))
		w := httptest.NewRecorder()
		if bulk {
			b.allFlagsHandler(w, req)
		} else {
			b.oneFlagHandler(w, mux.SetURLVars(req, map[string]string{"flagKey": "flag"}))
		}
		require.Equal(t, http.StatusBadRequest, w.Code)
	}
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
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
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
	b := withCohorts(newTestBuilder(t, endpoint), resolver)
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
	for name, mutate := range map[string]func(*CohortConfig){
		"snapshot age over 24h": func(c *CohortConfig) { c.MaxSnapshotAge = 25 * time.Hour },
		"no snapshot age":       func(c *CohortConfig) { c.MaxSnapshotAge = 0 },
		"cache ttl":             func(c *CohortConfig) { c.CacheTTL = 10 * time.Minute },
		"timeout":               func(c *CohortConfig) { c.Timeout = 0 },
		"concurrency":           func(c *CohortConfig) { c.MaxConcurrent = 0 },
		"missing token file":    func(c *CohortConfig) { c.TokenFile = filepath.Join(t.TempDir(), "missing") },
		"no token file":         func(c *CohortConfig) { c.TokenFile = "" },
		"wildcard namespace":    func(c *CohortConfig) { c.AllowedNamespaces = []string{"*"} },
	} {
		c := cohortTestConfig(t, "https://example.com/api")
		mutate(&c)
		require.Error(t, (&APIBuilder{}).EnableCohortEnrichment(c, nil), name)
	}
	empty := cohortTestConfig(t, "https://example.com/api")
	require.NoError(t, os.WriteFile(empty.TokenFile, []byte(" "), 0600))
	require.Error(t, (&APIBuilder{}).EnableCohortEnrichment(empty, nil))

	for _, ns := range []string{"*", "stacks-0", "stacks-01", "stacks-1/2", "orgs-1"} {
		_, ok := cohortStackID(ns)
		require.False(t, ok)
	}
	u, _ := url.Parse("https://example.com")
	require.NotNil(t, newCohortResolver(CohortConfig{MaxConcurrent: 1}, u))
}

func TestCohortConfigurationRuntime(t *testing.T) {
	c := cohortTestConfig(t, "https://example.com/api")
	c.MaxConcurrent = 16
	c.MaxSnapshotAge = maxCohortSnapshotAge
	reg := prometheus.NewRegistry()
	first, second := &APIBuilder{}, &APIBuilder{}
	require.NoError(t, first.EnableCohortEnrichment(c, reg))
	require.NoError(t, second.EnableCohortEnrichment(c, reg), "an already registered collector is reused")
	require.Same(t, first.cohorts.outcomes, second.cohorts.outcomes)
	require.Same(t, first.cohorts.duration, second.cohorts.duration)

	transport, ok := first.cohorts.client.Transport.(*http.Transport)
	require.True(t, ok)
	require.NotSame(t, http.DefaultTransport, transport)
	require.GreaterOrEqual(t, transport.MaxIdleConnsPerHost, c.MaxConcurrent)
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
	withCohorts(b, cohortTestResolver(t, func(w http.ResponseWriter, r *http.Request) { cohortResponse(w, r, time.Now()) }))
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
