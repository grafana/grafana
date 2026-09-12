# Router Active Discovery for Aggregate Apiservers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the `pkg/router` GrafanaRouter aggregate API groups from two well-known upstream apiservers (`baas_apiserver`, `cloud_app_platform_apiserver`) by actively polling their `/apis` discovery endpoint — filtered by an optional per-target group-name shortlist — while keeping request health/circuit-breaking passive, unchanged from today.

**Architecture:** Two new fixed, config-driven aggregate targets are polled on independent goroutines inside the existing `cloudLoader` (one per apiserver, each with its own cooldown/backoff so a downed upstream is polled less and less often instead of being spammed). Each poll produces a `[]Backend` snapshot of `aggregateBackend` (one per matched group, reverse-proxying to that apiserver). `cloudLoader.Load()` merges these snapshots with its existing CRD-derived backends; a target only wakes `reconcile` (via the shared `dirty` channel) when its discovered group set actually changes. Everything downstream of `Load()` — reconcile, the per-group `gobreaker` breaker, discovery/openapi serving — is unchanged and backend-type-agnostic, so aggregate groups get passive circuit breaking for free, same as `forward` groups.

**Tech Stack:** Go, `k8s.io/apimachinery/pkg/apis/meta/v1` (`metav1.APIGroup`/`APIGroupList`), `k8s.io/client-go/rest` (`rest.Config`, `rest.HTTPClientFor`), existing `authnlib`/`clientauth` token-exchange wrapper, `net/http/httputil.ReverseProxy`, stdlib `testing` + `httptest` (matches package convention).

**Spec:** This plan's own "Design Decisions" section below, plus the companion design doc it produces at `pkg/router/specs/2026-09-11-router-aggregate-discovery-design.md` (Task 8) — write that file to match the style of the two existing docs in that directory (`2026-08-17-router-discovery-openapi-design.md`, `2026-08-19-router-circuit-breaker-design.md`), since `pkg/router/AGENTS.md` explicitly points readers at `specs/` for this kind of decision writeup.

## Global Constraints

- Passive circuit breaking is unchanged and non-negotiable: no new active health probe, no new `Backend` health method. `pkg/router/AGENTS.md`'s "Passive circuit breaking" section stays true as written; this plan only adds *discovery* (which groups exist), never *health* (is this group's backend currently serving well) — see "Reconciling with AGENTS.md" below, that section must be amended, not contradicted.
- Deployment-specific/kind-aware logic stays out of `router.go`/`types.go`, per `pkg/router/AGENTS.md`'s package-layout rule — all new code lives in new `pkg/router/aggregate_*.go` files plus edits to `cloud_router.go`. No new exported method on the `Backend` or `RoutesLoader` interfaces (that would need explicit human sign-off per AGENTS.md's "never delete/change interfaces in types.go without sign-off" rule, and isn't needed here).
- Config is read directly via `cfg.SectionWithEnvOverrides(cloudRouterSection)`, no new `pkg/setting` struct field — same pattern the existing `apiserver_url`/`cap_token` keys use, per AGENTS.md.
- `apiserver_url` is renamed to `appmanifest_apiserver_url` (user's explicit instruction — the CRD control-plane apiserver is conceptually distinct from the two new aggregate targets). `cap_token` and `token_exchange_url` stay shared across all three upstream targets; `baas_apiserver`/`cloud_app_platform_apiserver` each get their own `audience` key for token-exchange, since a shared token can be exchanged for different audiences per target.
- The two aggregate targets are **fixed, named, independent of the CRD connection** — `baas_apiserver.*` and `cloud_app_platform_apiserver.*` work whether or not `appmanifest_apiserver_url` is set (per explicit user answer: "CRDs are beside the point here"). `cap_token`/`token_exchange_url` become required as soon as *any* of the three URL keys is set, not just `appmanifest_apiserver_url`.
- Per-target `group_regex` is optional — unset means "aggregate every group that target's `/apis` returns," matching the original ask ("optional arg... so that not all the other apiGroups... get aggregated").
- Poll interval and min/max backoff are **not** exposed as ini keys in this plan (not in the user's explicit key list) — hardcoded constants with sane defaults, called out as an assumption in Task 5, easy to promote to config later if needed.
- TLS options (`apiserver_ca_file`/`apiserver_insecure`) are **not** duplicated per aggregate target in this plan — they stay scoped to `appmanifest_apiserver_url` as today. Aggregate targets get the token-exchange transport wrapper but plain TLS (system roots, no insecure-skip). Flagged as a follow-up in Task 8's design doc, not solved here (no user ask for per-target CA/insecure yet).

---

## Design Decisions

### Reconciling with AGENTS.md's "Passive circuit breaking"

`pkg/router/AGENTS.md` (and `specs/2026-08-19-router-circuit-breaker-design.md`) records a deliberate decision *against* kube-aggregator's active `AvailabilityController` pattern — but that decision is about **health probing to gate serving/discovery**, i.e. "is this group's backend up right now, and should `/apis` say so." This plan does not touch that: `publish()` still synthesizes `/apis`/`/openapi/v3` from `r.served` (config/install state) unconditionally, and the per-group `gobreaker` breaker still gates every actual proxied request/response, unchanged, for `aggregateBackend` exactly as for `forwardBackend`.

What *is* new is **discovery of which groups exist at all**. For `forward` backends this is free — the group comes from a `RouteBackend` CR, so the router already knows it without asking the backend. For an aggregate target there is no CR; the only source of truth for "what groups does `baas_apiserver` currently serve" is `baas_apiserver` itself, so learning that requires an active call to its `/apis` endpoint. This is unavoidable and orthogonal to the health-probing decision AGENTS.md rejected — Task 8 amends AGENTS.md to state this distinction explicitly so a future reader doesn't read "passive-only" and assume it also forbids this.

### Cooldown / backoff (the user's explicit ask)

Each aggregate target gets its own poll loop with a `cooldown` (Task 3): normal steady-state polling at a fixed interval; on a failed discovery call, the next attempt is delayed by an exponentially growing backoff (capped), reset to the steady-state interval on the next success. This bounds request volume against a downed apiserver without needing a circuit breaker of its own (a breaker is for gating request *serving*; here there is no serving to gate, only a background poll to throttle — a plain backoff is the right-sized tool, not `gobreaker`). Because a failed poll never changes the discovered group snapshot, it also never signals `dirty` — so a downed target doesn't cause spurious `reconcile` wakeups on top of not spamming HTTP requests.

### Why merge into `cloudLoader` rather than a new top-level `RoutesLoader`

`GrafanaRouter` takes exactly one `RoutesLoader` (`router.go:80`). `pkg/router/AGENTS.md` already anticipates a third goroutine inside `cloudLoader.running`'s errgroup for exactly this kind of addition (see the Explore agent's citation of the wiring chain) — reusing that lifecycle avoids inventing a second loader-composition mechanism, and `cloudLoader.Load()` already has the right shape (`combineByName`-style merge of multiple backend sources into one `[]Backend`).

---

## Task 1: Rename `apiserver_url` → `appmanifest_apiserver_url`, broaden activation gate

**Files:**
- Modify: `pkg/router/cloud_router.go:29-83` (`ProvideCloudRoutesLoaderFactory`)
- Modify: `pkg/router/AGENTS.md` (wherever `apiserver_url` is documented — update the key name)
- Test: `pkg/router/cloud_router_test.go`

**Interfaces:**
- Produces: `ProvideCloudRoutesLoaderFactory(cfg *setting.Cfg) (RoutesLoader, error)` keeps its exact signature; only its internal ini-key reads and activation condition change. Later tasks (6) extend this same function.

- [ ] **Step 1: Write the failing test**

Add to `pkg/router/cloud_router_test.go` (adjust to match existing test helpers in that file, e.g. however it currently builds a `*setting.Cfg` with an ini section — follow that exact pattern rather than reinventing it):

```go
func TestProvideCloudRoutesLoaderFactory_RenamedKey(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"appmanifest_apiserver_url": "https://example.invalid",
		"cap_token":                 "tok",
		"token_exchange_url":        "https://exchange.invalid",
	})

	loader, err := ProvideCloudRoutesLoaderFactory(cfg)
	require.NoError(t, err)
	require.NotNil(t, loader)
}

func TestProvideCloudRoutesLoaderFactory_NoTargetsConfigured(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})

	loader, err := ProvideCloudRoutesLoaderFactory(cfg)
	require.NoError(t, err)
	require.Nil(t, loader) // falls back to dummyRoutesLoader upstream
}
```

If `cfgWithCloudRouterSection` doesn't already exist in the test file, add it as a small helper mirroring whatever inline ini-building code the existing tests use (check `cloud_router_test.go` for the current pattern before writing this — do not invent a second way to build test config).

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./pkg/router/... -run TestProvideCloudRoutesLoaderFactory -v`
Expected: FAIL — `appmanifest_apiserver_url` key doesn't exist yet, factory still reads `apiserver_url` so `loader` comes back `nil` for the first test.

- [ ] **Step 3: Rename the key and broaden the gate**

In `pkg/router/cloud_router.go`, change:

```go
apiserverURL := section.Key("apiserver_url").MustString("")
if apiserverURL == "" {
	return nil, nil
}
```

to:

```go
appManifestApiserverURL := section.Key("appmanifest_apiserver_url").MustString("")
```

and defer the "nothing configured → nil, nil" check until after Task 6 adds the two aggregate-target URL reads (this task alone makes the factory always proceed past this point when *only* the rename matters — Task 6 is what actually adds the broadened multi-target gate). For this task in isolation, keep behavior equivalent to today but on the new key name:

```go
appManifestApiserverURL := section.Key("appmanifest_apiserver_url").MustString("")
if appManifestApiserverURL == "" {
	return nil, nil
}
```

Update every other use of the old local var name `apiserverURL` in the function body to `appManifestApiserverURL`, and update the `rest.Config{Host: ...}` call site accordingly. Update the doc comment above `ProvideCloudRoutesLoaderFactory` (and any AGENTS.md prose quoting `apiserver_url`) to say `appmanifest_apiserver_url`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./pkg/router/... -v`
Expected: PASS for the renamed-key test. The `NoTargetsConfigured` test still fails at this point (expected — Task 6 makes it pass); leave it in the test file with a `t.Skip("enabled in Task 6")` for now so `go test` is green, and remove the skip in Task 6.

- [ ] **Step 5: Commit**

```bash
git add pkg/router/cloud_router.go pkg/router/cloud_router_test.go pkg/router/AGENTS.md
git commit -m "router: rename cloud_router apiserver_url to appmanifest_apiserver_url"
```

---

## Task 2: Glob-style group-name shortlist + per-target config parsing

**Files:**
- Create: `pkg/router/aggregate_config.go`
- Test: `pkg/router/aggregate_config_test.go`

**Interfaces:**
- Produces:
  - `type aggregateTargetConfig struct { Name, URL, Audience string; GroupPatterns []string }`
  - `func compileGroupPatterns(patterns []string) ([]*regexp.Regexp, error)`
  - `func matchesAnyPattern(groupName string, patterns []*regexp.Regexp) bool` — `true` (aggregate everything) when `patterns` is empty
  - `func parseAggregateTargets(section *setting.DynamicSection) ([]aggregateTargetConfig, error)` — reads exactly the two fixed names `baas_apiserver` and `cloud_app_platform_apiserver` via dotted keys (`<name>.url`, `<name>.group_regex`, `<name>.audience`); a target is included only if its `.url` key is non-empty. `group_regex` is read as a comma-separated list of glob patterns (may be absent/empty → `nil` patterns, meaning "match everything").
- Consumes: `*setting.DynamicSection` — the type returned by `cfg.SectionWithEnvOverrides(cloudRouterSection)`, already used throughout `cloud_router.go`; confirm the exact type name by reading `cloud_router.go`'s existing `section :=` line before writing this (it's whatever `(*setting.Cfg).SectionWithEnvOverrides` returns).

- [ ] **Step 1: Write the failing tests**

```go
package router

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCompileGroupPatterns(t *testing.T) {
	patterns, err := compileGroupPatterns([]string{"*.grafana.app", "*.grafana.com"})
	require.NoError(t, err)

	require.True(t, matchesAnyPattern("dashboard.grafana.app", patterns))
	require.True(t, matchesAnyPattern("billing.grafana.com", patterns))
	require.False(t, matchesAnyPattern("apps", patterns))
	require.False(t, matchesAnyPattern("coordination.k8s.io", patterns))
}

func TestMatchesAnyPattern_EmptyMeansMatchAll(t *testing.T) {
	require.True(t, matchesAnyPattern("anything.at.all", nil))
}

func TestCompileGroupPatterns_InvalidPattern(t *testing.T) {
	_, err := compileGroupPatterns([]string{"[unterminated"})
	require.Error(t, err)
}

func TestParseAggregateTargets(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"baas_apiserver.url":                          "https://baas.example.invalid",
		"baas_apiserver.group_regex":                  "*.grafana.app, *.grafana.com",
		"baas_apiserver.audience":                      "baas",
		"cloud_app_platform_apiserver.url":             "https://cap.example.invalid",
		"cloud_app_platform_apiserver.audience":        "cloud-app-platform",
	})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	targets, err := parseAggregateTargets(section)
	require.NoError(t, err)
	require.Len(t, targets, 2)

	byName := map[string]aggregateTargetConfig{}
	for _, target := range targets {
		byName[target.Name] = target
	}

	require.Equal(t, "https://baas.example.invalid", byName["baas_apiserver"].URL)
	require.Equal(t, "baas", byName["baas_apiserver"].Audience)
	require.Equal(t, []string{"*.grafana.app", "*.grafana.com"}, byName["baas_apiserver"].GroupPatterns)

	require.Equal(t, "https://cap.example.invalid", byName["cloud_app_platform_apiserver"].URL)
	require.Empty(t, byName["cloud_app_platform_apiserver"].GroupPatterns)
}

func TestParseAggregateTargets_NoneConfigured(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	targets, err := parseAggregateTargets(section)
	require.NoError(t, err)
	require.Empty(t, targets)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./pkg/router/... -run 'TestCompileGroupPatterns|TestMatchesAnyPattern|TestParseAggregateTargets' -v`
Expected: FAIL — none of these symbols exist yet (compile error).

- [ ] **Step 3: Implement**

```go
// pkg/router/aggregate_config.go
package router

import (
	"fmt"
	"regexp"
	"strings"
)

// aggregateTargetConfig is one fixed, named upstream apiserver whose API
// groups this router discovers and aggregates -- as opposed to a forward
// backend's group, which comes from a RouteBackend CR and needs no
// discovery. Name is one of the two fixed keys read by
// parseAggregateTargets ("baas_apiserver", "cloud_app_platform_apiserver"),
// not a user-chosen label -- there is no dynamic list, only these two.
type aggregateTargetConfig struct {
	Name          string
	URL           string
	Audience      string
	GroupPatterns []string
}

// aggregateTargetNames are the only two upstream apiservers this router
// aggregates today. Adding a third later means adding its name here and to
// parseAggregateTargets, not building a dynamic ini-list mechanism -- see
// the design doc's rationale for why these are fixed rather than arbitrary.
var aggregateTargetNames = []string{"baas_apiserver", "cloud_app_platform_apiserver"}

// parseAggregateTargets reads the two fixed aggregate-apiserver targets from
// the cloud_router section using dotted key names (<name>.url,
// <name>.group_regex, <name>.audience). A target is included in the result
// only if its .url key is set; group_regex is optional (nil means "match
// every group", not "match nothing" -- see matchesAnyPattern).
func parseAggregateTargets(section aggregateSectionReader) ([]aggregateTargetConfig, error) {
	var targets []aggregateTargetConfig
	for _, name := range aggregateTargetNames {
		url := section.Key(name + ".url").MustString("")
		if url == "" {
			continue
		}
		var patterns []string
		if raw := section.Key(name + ".group_regex").MustString(""); raw != "" {
			for _, p := range strings.Split(raw, ",") {
				patterns = append(patterns, strings.TrimSpace(p))
			}
		}
		targets = append(targets, aggregateTargetConfig{
			Name:          name,
			URL:           url,
			Audience:      section.Key(name + ".audience").MustString(""),
			GroupPatterns: patterns,
		})
	}
	return targets, nil
}

// compileGroupPatterns turns glob-style patterns ("*.grafana.app") into
// anchored regexps. Only "*" is special (translated to ".*"); every other
// character is escaped literally, since group names are plain
// dot-separated identifiers, not paths, so there is no need for "?" or
// character classes.
func compileGroupPatterns(patterns []string) ([]*regexp.Regexp, error) {
	compiled := make([]*regexp.Regexp, 0, len(patterns))
	for _, p := range patterns {
		var b strings.Builder
		b.WriteString("^")
		for _, part := range strings.Split(p, "*") {
			b.WriteString(regexp.QuoteMeta(part))
			b.WriteString(".*")
		}
		pattern := strings.TrimSuffix(b.String(), ".*") + "$"
		re, err := regexp.Compile(pattern)
		if err != nil {
			return nil, fmt.Errorf("router: invalid group pattern %q: %w", p, err)
		}
		compiled = append(compiled, re)
	}
	return compiled, nil
}

// matchesAnyPattern reports whether groupName matches any of patterns.
// An empty/nil patterns list means "aggregate every group" -- the
// shortlist is opt-in narrowing, not opt-in inclusion (see AGENTS.md's
// framing of group_regex as an optional narrowing arg).
func matchesAnyPattern(groupName string, patterns []*regexp.Regexp) bool {
	if len(patterns) == 0 {
		return true
	}
	for _, re := range patterns {
		if re.MatchString(groupName) {
			return true
		}
	}
	return false
}

// aggregateSectionReader is the minimal slice of *setting.DynamicSection's
// interface parseAggregateTargets needs, so its tests can pass a real
// section without pulling in unrelated setting.Cfg machinery. Confirm this
// matches the real returned type's Key(...) method signature before
// wiring parseAggregateTargets into cloud_router.go in Task 6.
type aggregateSectionReader interface {
	Key(string) *ini.Key
}
```

Before finalizing this step: run `grep -n "SectionWithEnvOverrides" pkg/setting/setting.go` and `grep -n "func.*Key(" $(go env GOPATH)/pkg/mod/gopkg.in/ini.v1*/ini.go 2>/dev/null || true` (or equivalent) to confirm the real return types of `section.Key(...)` (likely `*ini.Key` from `gopkg.in/ini.v1`) and adjust `aggregateSectionReader`'s method signature to match exactly — do not guess and leave it wrong, this interface must compile against the real `*setting.DynamicSection`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./pkg/router/... -run 'TestCompileGroupPatterns|TestMatchesAnyPattern|TestParseAggregateTargets' -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pkg/router/aggregate_config.go pkg/router/aggregate_config_test.go
git commit -m "router: parse baas_apiserver/cloud_app_platform_apiserver config"
```

---

## Task 3: Cooldown/backoff helper

**Files:**
- Create: `pkg/router/aggregate_backoff.go`
- Test: `pkg/router/aggregate_backoff_test.go`

**Interfaces:**
- Produces:
  - `type cooldown struct { ... }` (unexported fields)
  - `func newCooldown(steady, min, max time.Duration) *cooldown`
  - `func (c *cooldown) Ready(now time.Time) bool`
  - `func (c *cooldown) OnSuccess(now time.Time)`
  - `func (c *cooldown) OnFailure(now time.Time)`
- Consumes: nothing from earlier tasks. Consumed by Task 5's poller loop.

- [ ] **Step 1: Write the failing test**

```go
package router

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCooldown_SteadyStateWhenHealthy(t *testing.T) {
	now := time.Unix(0, 0)
	c := newCooldown(30*time.Second, 5*time.Second, 5*time.Minute)

	require.True(t, c.Ready(now))
	c.OnSuccess(now)
	require.False(t, c.Ready(now.Add(1*time.Second)))
	require.True(t, c.Ready(now.Add(30*time.Second)))
}

func TestCooldown_BacksOffOnFailureAndCapsAtMax(t *testing.T) {
	now := time.Unix(0, 0)
	c := newCooldown(30*time.Second, 5*time.Second, 20*time.Second)

	c.OnFailure(now) // 1st failure: wait min (5s)
	require.False(t, c.Ready(now.Add(4*time.Second)))
	require.True(t, c.Ready(now.Add(5*time.Second)))

	now = now.Add(5 * time.Second)
	c.OnFailure(now) // 2nd consecutive failure: doubles to 10s
	require.False(t, c.Ready(now.Add(9*time.Second)))
	require.True(t, c.Ready(now.Add(10*time.Second)))

	now = now.Add(10 * time.Second)
	c.OnFailure(now) // 3rd: would double to 20s, at cap
	require.False(t, c.Ready(now.Add(19*time.Second)))
	require.True(t, c.Ready(now.Add(20*time.Second)))

	now = now.Add(20 * time.Second)
	c.OnFailure(now) // 4th: stays capped at 20s, never exceeds max
	require.True(t, c.Ready(now.Add(20*time.Second)))
	require.False(t, c.Ready(now.Add(19*time.Second)))
}

func TestCooldown_SuccessResetsToSteadyInterval(t *testing.T) {
	now := time.Unix(0, 0)
	c := newCooldown(30*time.Second, 5*time.Second, 5*time.Minute)

	c.OnFailure(now)
	c.OnFailure(now.Add(5 * time.Second))
	now = now.Add(5 * time.Second)

	c.OnSuccess(now)
	require.False(t, c.Ready(now.Add(29*time.Second)))
	require.True(t, c.Ready(now.Add(30*time.Second)))
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./pkg/router/... -run TestCooldown -v`
Expected: FAIL (compile error, `newCooldown` undefined).

- [ ] **Step 3: Implement**

```go
// pkg/router/aggregate_backoff.go
package router

import "time"

// cooldown paces one aggregate target's discovery polls: a fixed interval
// while healthy, exponential backoff (capped) after a failure, reset to the
// fixed interval on the next success. This is deliberately not a
// gobreaker.CircuitBreaker -- a breaker gates request *serving* (open/
// half-open/closed against caller traffic); this only throttles a
// background poll's own outbound call rate, so there is no caller-facing
// state to protect and a plain backoff is the right-sized tool. See
// AGENTS.md's amended discovery section for why this exists alongside,
// not instead of, the per-group gobreaker breaker.
type cooldown struct {
	steady, min, max time.Duration
	next             time.Time
	current          time.Duration
}

func newCooldown(steady, min, max time.Duration) *cooldown {
	return &cooldown{steady: steady, min: min, max: max}
}

// Ready reports whether a poll attempt may run now.
func (c *cooldown) Ready(now time.Time) bool {
	return !now.Before(c.next)
}

// OnSuccess resets the poller to its steady-state interval.
func (c *cooldown) OnSuccess(now time.Time) {
	c.current = 0
	c.next = now.Add(c.steady)
}

// OnFailure doubles the backoff (starting from min), capped at max, and
// schedules the next allowed attempt accordingly.
func (c *cooldown) OnFailure(now time.Time) {
	switch {
	case c.current == 0:
		c.current = c.min
	case c.current*2 > c.max:
		c.current = c.max
	default:
		c.current *= 2
	}
	c.next = now.Add(c.current)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./pkg/router/... -run TestCooldown -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pkg/router/aggregate_backoff.go pkg/router/aggregate_backoff_test.go
git commit -m "router: add cooldown/backoff helper for aggregate discovery polling"
```

---

## Task 4: Discovery HTTP client + `aggregateBackend`

**Files:**
- Create: `pkg/router/aggregate_discovery.go`
- Test: `pkg/router/aggregate_discovery_test.go`

**Interfaces:**
- Produces:
  - `func discoverGroups(ctx context.Context, client *http.Client, baseURL string) ([]metav1.APIGroup, error)` — `GET {baseURL}/apis`, decode `metav1.APIGroupList`, return `.Groups`.
  - `type aggregateBackend struct { ... }` implementing `Backend` (`pkg/router/types.go:10-19`: `Key() string`, `Group() metav1.APIGroup`, `Load(context.Context) (http.Handler, error)`)
  - `func newAggregateBackend(targetName string, group metav1.APIGroup, base *url.URL, transport http.RoundTripper) (Backend, error)`
- Consumes: nothing new from earlier tasks (standalone HTTP/proxy plumbing). Consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

```go
package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestDiscoverGroups(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/apis", r.URL.Path)
		list := metav1.APIGroupList{
			Groups: []metav1.APIGroup{
				{Name: "dashboard.grafana.app"},
				{Name: "coordination.k8s.io"},
			},
		}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer srv.Close()

	groups, err := discoverGroups(t.Context(), srv.Client(), srv.URL)
	require.NoError(t, err)
	require.Len(t, groups, 2)
	require.Equal(t, "dashboard.grafana.app", groups[0].Name)
}

func TestDiscoverGroups_NonOKStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	_, err := discoverGroups(t.Context(), srv.Client(), srv.URL)
	require.Error(t, err)
}

func TestAggregateBackend_ProxiesToTargetHost(t *testing.T) {
	var gotPath string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	base, err := url.Parse(upstream.URL)
	require.NoError(t, err)

	group := metav1.APIGroup{Name: "dashboard.grafana.app"}
	backend, err := newAggregateBackend("baas_apiserver", group, base, http.DefaultTransport)
	require.NoError(t, err)
	require.Equal(t, group, backend.Group())
	require.NotEmpty(t, backend.Key())

	handler, err := backend.Load(t.Context())
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "/apis/dashboard.grafana.app/v1", gotPath)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./pkg/router/... -run 'TestDiscoverGroups|TestAggregateBackend' -v`
Expected: FAIL (compile error).

- [ ] **Step 3: Implement**

```go
// pkg/router/aggregate_discovery.go
package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// discoverGroups fetches and decodes the APIGroupList a target apiserver
// exposes at /apis. This is the one place this router actively dials an
// upstream to learn what it serves -- see AGENTS.md's discovery section for
// why this is necessary here but not for forward backends.
func discoverGroups(ctx context.Context, client *http.Client, baseURL string) ([]metav1.APIGroup, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+apisPrefix, nil)
	if err != nil {
		return nil, fmt.Errorf("router: building discovery request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("router: discovery request to %s failed: %w", baseURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("router: discovery request to %s returned status %d", baseURL, resp.StatusCode)
	}

	var list metav1.APIGroupList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil, fmt.Errorf("router: decoding APIGroupList from %s: %w", baseURL, err)
	}
	return list.Groups, nil
}

// aggregateBackend is a Backend for one group discovered on a fixed
// aggregate target (baas_apiserver or cloud_app_platform_apiserver). Its
// Load proxies to the target's own host, same shape as forwardBackend --
// the difference is entirely in how Group/Key are learned (discovery poll
// vs a RouteBackend CR), not in how requests are served.
type aggregateBackend struct {
	targetName string
	group      metav1.APIGroup
	key        string
	proxy      *httputil.ReverseProxy
}

var _ Backend = &aggregateBackend{}

func newAggregateBackend(targetName string, group metav1.APIGroup, base *url.URL, transport http.RoundTripper) (Backend, error) {
	body, err := json.Marshal(group)
	if err != nil {
		return nil, fmt.Errorf("router: fingerprinting discovered group %q: %w", group.Name, err)
	}
	sum := sha256.Sum256(body)
	key := "aggregate:" + targetName + ":" + hex.EncodeToString(sum[:])[:16]

	return &aggregateBackend{
		targetName: targetName,
		group:      group,
		key:        key,
		proxy: &httputil.ReverseProxy{
			Rewrite:        func(pr *httputil.ProxyRequest) { pr.SetURL(base) },
			Transport:      transport,
			ModifyResponse: rejectBackendRedirects,
		},
	}, nil
}

func (b *aggregateBackend) Group() metav1.APIGroup { return b.group }
func (b *aggregateBackend) Key() string            { return b.key }
func (b *aggregateBackend) Load(context.Context) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		b.proxy.ServeHTTP(w, req)
	}), nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./pkg/router/... -run 'TestDiscoverGroups|TestAggregateBackend' -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pkg/router/aggregate_discovery.go pkg/router/aggregate_discovery_test.go
git commit -m "router: add discovery client and aggregateBackend"
```

---

## Task 5: `aggregateTarget` poller loop (cooldown + discovery + regex filter + snapshot)

**Files:**
- Create: `pkg/router/aggregate_poller.go`
- Test: `pkg/router/aggregate_poller_test.go`

**Interfaces:**
- Consumes: `aggregateTargetConfig` (Task 2), `compileGroupPatterns`/`matchesAnyPattern` (Task 2), `*cooldown` (Task 3), `discoverGroups`/`newAggregateBackend` (Task 4).
- Produces:
  - `type aggregateTarget struct { ... }` (unexported fields)
  - `func newAggregateTarget(cfg aggregateTargetConfig, client *http.Client) (*aggregateTarget, error)`
  - `func (t *aggregateTarget) run(ctx context.Context, dirty chan<- struct{})` — blocks until `ctx` is done; polls on its own `cooldown`-paced ticker, updates its snapshot, sends (non-blocking) on `dirty` only when the discovered group set actually changed.
  - `func (t *aggregateTarget) Backends() []Backend` — the current snapshot, safe to call from any goroutine.
- Consumed by Task 6's `cloudLoader` wiring.

- [ ] **Step 1: Write the failing tests**

```go
package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestAggregateTarget_DiscoversAndFiltersGroups(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list := metav1.APIGroupList{Groups: []metav1.APIGroup{
			{Name: "dashboard.grafana.app"},
			{Name: "coordination.k8s.io"},
		}}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer srv.Close()

	target, err := newAggregateTarget(aggregateTargetConfig{
		Name:          "baas_apiserver",
		URL:           srv.URL,
		GroupPatterns: []string{"*.grafana.app"},
	}, srv.Client())
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(t.Context())
	dirty := make(chan struct{}, 1)
	go target.run(ctx, dirty)

	require.Eventually(t, func() bool {
		return len(target.Backends()) == 1
	}, 2*time.Second, 10*time.Millisecond)

	backends := target.Backends()
	require.Equal(t, "dashboard.grafana.app", backends[0].Group().Name)
	cancel()
}

func TestAggregateTarget_CooldownLimitsRequestsWhileDown(t *testing.T) {
	var attempts atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	target, err := newAggregateTarget(aggregateTargetConfig{
		Name: "baas_apiserver",
		URL:  srv.URL,
	}, srv.Client())
	require.NoError(t, err)
	target.pollInterval = 10 * time.Millisecond
	target.cooldown = newCooldown(10*time.Millisecond, 200*time.Millisecond, time.Second)

	ctx, cancel := context.WithCancel(t.Context())
	dirty := make(chan struct{}, 1)
	go target.run(ctx, dirty)

	time.Sleep(150 * time.Millisecond)
	cancel()

	// Without backoff, a 10ms poll interval over 150ms would be ~15
	// attempts; with a 200ms floor after the first failure, it must be
	// at most 2 (the initial attempt plus, at most, one more right at
	// the boundary).
	require.LessOrEqual(t, attempts.Load(), int64(2))
	require.Empty(t, target.Backends())
}
```

Add `"context"` to imports.

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./pkg/router/... -run TestAggregateTarget -v`
Expected: FAIL (compile error, `newAggregateTarget`/`run`/`Backends` undefined, and `pollInterval`/`cooldown` fields not present for the test to override).

- [ ] **Step 3: Implement**

```go
// pkg/router/aggregate_poller.go
package router

import (
	"context"
	"net/http"
	"net/url"
	"regexp"
	"sync/atomic"
	"time"

	"log/slog"
)

// Defaults for aggregate-target polling. Not exposed as ini keys in this
// iteration -- see the plan's Global Constraints for why -- but isolated
// here so promoting them to config later touches one place.
const (
	defaultAggregatePollInterval = 30 * time.Second
	defaultAggregateMinBackoff   = 5 * time.Second
	defaultAggregateMaxBackoff   = 5 * time.Minute
)

// aggregateTarget owns one fixed upstream apiserver's discovery poll loop.
// Backends() is read by cloudLoader.Load() (any goroutine); run() is the
// sole writer of snapshot, on its own goroutine -- hence atomic.Pointer
// rather than a mutex.
type aggregateTarget struct {
	name     string
	base     *url.URL
	client   *http.Client
	patterns []*regexp.Regexp

	pollInterval time.Duration
	cooldown     *cooldown

	snapshot atomic.Pointer[[]Backend]
	lastKeys atomic.Pointer[map[string]struct{}]
}

func newAggregateTarget(cfg aggregateTargetConfig, client *http.Client) (*aggregateTarget, error) {
	base, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, err
	}
	patterns, err := compileGroupPatterns(cfg.GroupPatterns)
	if err != nil {
		return nil, err
	}
	t := &aggregateTarget{
		name:         cfg.Name,
		base:         base,
		client:       client,
		patterns:     patterns,
		pollInterval: defaultAggregatePollInterval,
		cooldown:     newCooldown(defaultAggregatePollInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
	}
	empty := []Backend{}
	t.snapshot.Store(&empty)
	emptyKeys := map[string]struct{}{}
	t.lastKeys.Store(&emptyKeys)
	return t, nil
}

// Backends returns the current discovered-and-filtered backend snapshot.
// Safe to call from any goroutine.
func (t *aggregateTarget) Backends() []Backend {
	return *t.snapshot.Load()
}

// run polls until ctx is done, respecting t.cooldown between attempts.
// Signals dirty (non-blocking, coalescing -- matches cloudLoader.dirty's
// existing contract) only when the discovered key set actually changed, so
// a downed or unchanged target never triggers a needless reconcile.
func (t *aggregateTarget) run(ctx context.Context, dirty chan<- struct{}) {
	ticker := time.NewTicker(t.pollInterval)
	defer ticker.Stop()

	t.poll(ctx, dirty) // first attempt immediately, don't wait a full interval
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			t.poll(ctx, dirty)
		}
	}
}

func (t *aggregateTarget) poll(ctx context.Context, dirty chan<- struct{}) {
	now := time.Now()
	if !t.cooldown.Ready(now) {
		return
	}

	groups, err := discoverGroups(ctx, t.client, t.base.String())
	if err != nil {
		t.cooldown.OnFailure(now)
		slog.Warn("router: aggregate discovery poll failed, backing off", "target", t.name, "err", err)
		return
	}
	t.cooldown.OnSuccess(now)

	backends := make([]Backend, 0, len(groups))
	keys := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		if !matchesAnyPattern(group.Name, t.patterns) {
			continue
		}
		backend, err := newAggregateBackend(t.name, group, t.base, t.client.Transport)
		if err != nil {
			slog.Warn("router: skipping unfingerprintable discovered group", "target", t.name, "group", group.Name, "err", err)
			continue
		}
		backends = append(backends, backend)
		keys[backend.Key()] = struct{}{}
	}

	t.snapshot.Store(&backends)

	lastKeys := *t.lastKeys.Load()
	if !sameKeySet(lastKeys, keys) {
		t.lastKeys.Store(&keys)
		select {
		case dirty <- struct{}{}:
		default: // already pending; coalesce
		}
	}
}

func sameKeySet(a, b map[string]struct{}) bool {
	if len(a) != len(b) {
		return false
	}
	for k := range a {
		if _, ok := b[k]; !ok {
			return false
		}
	}
	return true
}
```

Note for the implementer: `t.client.Transport` may be `nil` (meaning `http.DefaultTransport`) — `newAggregateBackend`'s `httputil.ReverseProxy.Transport` field accepts `nil` the same way, so no extra nil-check is needed, but double check this against `httputil.ReverseProxy`'s doc comment while implementing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./pkg/router/... -run TestAggregateTarget -v -race`
Expected: PASS. Use `-race` here specifically — this test is the first one exercising concurrent `Backends()` reads against `run()`'s writes, and `atomic.Pointer` misuse is exactly the kind of bug `-race` catches that a non-race run won't.

- [ ] **Step 5: Commit**

```bash
git add pkg/router/aggregate_poller.go pkg/router/aggregate_poller_test.go
git commit -m "router: add aggregateTarget discovery poll loop with cooldown"
```

---

## Task 6: Wire aggregate targets into `cloudLoader`

**Files:**
- Modify: `pkg/router/cloud_router.go` (struct `cloudLoader`, `ProvideCloudRoutesLoaderFactory`, `starting`/`running`/`Load`/`Notify` — read the current bodies of these before editing; exact line numbers will have shifted after Task 1)
- Test: `pkg/router/cloud_router_test.go`

**Interfaces:**
- Consumes: `parseAggregateTargets` (Task 2), `newAggregateTarget`/`aggregateTarget.run`/`.Backends()` (Task 5), `rest.HTTPClientFor` (client-go, already vendored via `k8s.io/client-go/rest`).
- Produces: `cloudLoader` gains a field `aggregateTargets []*aggregateTarget`; `Load()`'s return now includes `append(crdBackends, aggregateBackends...)`.

- [ ] **Step 1: Write the failing tests**

```go
func TestCloudLoader_AggregateOnlyNoAppManifest(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list := metav1.APIGroupList{Groups: []metav1.APIGroup{{Name: "dashboard.grafana.app"}}}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer upstream.Close()

	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"cap_token":                     "tok",
		"token_exchange_url":            "https://exchange.invalid",
		"baas_apiserver.url":            upstream.URL,
		"baas_apiserver.audience":       "baas",
	})

	loader, err := ProvideCloudRoutesLoaderFactory(cfg)
	require.NoError(t, err)
	require.NotNil(t, loader) // must activate without appmanifest_apiserver_url set

	// Exercise Load()/the poll loop through whatever lifecycle
	// entrypoint cloudLoader actually exposes (services.BasicService's
	// StartAsync/AwaitRunning, per the existing tests in this file for
	// the CRD path) rather than calling an internal method directly --
	// match the existing test's start/stop pattern in this file exactly.
}
```

Adjust this test to actually drive `cloudLoader` through its real `services.Service` lifecycle exactly as the existing CRD-path tests in `cloud_router_test.go` do (read those first — do not invent a different startup sequence). The assertion that matters: after starting the loader and waiting for at least one poll (`require.Eventually`), `loader.Load(ctx)` returns a backend for `dashboard.grafana.app`.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./pkg/router/... -run TestCloudLoader_AggregateOnly -v`
Expected: FAIL — factory still returns `nil, nil` because only `appmanifest_apiserver_url` gates activation.

- [ ] **Step 3: Implement**

In `pkg/router/cloud_router.go`, extend the activation + construction logic. Read the *current* full body of `ProvideCloudRoutesLoaderFactory` and `cloudLoader`/`newCloudLoader` first (it will have shifted from Task 1's edits) and adapt precisely — the sketch below shows the shape of the change, not a verbatim diff:

```go
func ProvideCloudRoutesLoaderFactory(cfg *setting.Cfg) (RoutesLoader, error) {
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	appManifestApiserverURL := section.Key("appmanifest_apiserver_url").MustString("")
	aggregateTargetConfigs, err := parseAggregateTargets(section)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", cloudRouterSection, err)
	}

	if appManifestApiserverURL == "" && len(aggregateTargetConfigs) == 0 {
		return nil, nil
	}

	capToken := section.Key("cap_token").MustString("")
	tokenExchangeURL := section.Key("token_exchange_url").MustString("")
	if capToken == "" || tokenExchangeURL == "" {
		return nil, fmt.Errorf("%s: cap_token and token_exchange_url are required when appmanifest_apiserver_url, baas_apiserver.url, or cloud_app_platform_apiserver.url is set", cloudRouterSection)
	}

	tokenExchanger, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		TokenExchangeURL: tokenExchangeURL,
		Token:            capToken,
	})
	if err != nil {
		return nil, fmt.Errorf("token exchange client: %w", err)
	}

	var aggregateTargets []*aggregateTarget
	for _, targetCfg := range aggregateTargetConfigs {
		if targetCfg.Audience == "" {
			return nil, fmt.Errorf("%s: %s.audience is required when %s.url is set", cloudRouterSection, targetCfg.Name, targetCfg.Name)
		}
		restCfg := &rest.Config{
			Host:            targetCfg.URL,
			WrapTransport:   clientauth.NewStaticTokenExchangeTransportWrapper(tokenExchanger, targetCfg.Audience, clientauth.WildcardNamespace),
		}
		httpClient, err := rest.HTTPClientFor(restCfg)
		if err != nil {
			return nil, fmt.Errorf("%s: building http client for %s: %w", cloudRouterSection, targetCfg.Name, err)
		}
		target, err := newAggregateTarget(targetCfg, httpClient)
		if err != nil {
			return nil, fmt.Errorf("%s: %s: %w", cloudRouterSection, targetCfg.Name, err)
		}
		aggregateTargets = append(aggregateTargets, target)
	}

	var clients *k8s.ClientRegistry
	if appManifestApiserverURL != "" {
		restCfg := rest.Config{
			APIPath: "/apis",
			Host:    appManifestApiserverURL,
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: section.Key("apiserver_insecure").MustBool(false),
				CAFile:   section.Key("apiserver_ca_file").MustString(""),
			},
			WrapTransport: clientauth.NewStaticTokenExchangeTransportWrapper(tokenExchanger, v1alpha2.APIGroup, clientauth.WildcardNamespace),
		}
		clients = k8s.NewClientRegistry(restCfg, k8s.ClientConfig{})
	}

	return newCloudLoader(clients, aggregateTargets)
}
```

Then in `cloudLoader`:

```go
type cloudLoader struct {
	*services.BasicService

	dirty                      chan struct{}
	routeBackendClient         *v1alpha2.RouteBackendClient // nil if appmanifest not configured
	appManifestClient          *v1alpha2.AppManifestClient  // nil if appmanifest not configured
	transports                 map[tlsCacheKey]*http.Transport
	dialer                     *transport.DialHolder
	coreGroupsWithoutManifests map[string]metav1.APIGroup

	clients    *k8s.ClientRegistry // nil if appmanifest not configured
	rbInformer operator.Informer   // nil if appmanifest not configured
	amInformer operator.Informer   // nil if appmanifest not configured

	aggregateTargets []*aggregateTarget
}
```

`newCloudLoader` must tolerate `clients == nil` (skip building `routeBackendClient`/`appManifestClient`/informers entirely when the appmanifest connection isn't configured — read its current body to see exactly what to guard). In `starting`/`running`, start one goroutine per `aggregateTargets` entry calling `target.run(ctx, l.dirty)`, alongside (not replacing) the existing informer goroutines — read the current errgroup-based body of `running` and add these as additional `g.Go(...)` entries; if `clients == nil`, the informer-related `g.Go` calls must simply be skipped (guard with `if l.clients != nil`).

In `Load`:

```go
func (l *cloudLoader) Load(ctx context.Context) ([]Backend, error) {
	var backends []Backend
	if l.routeBackendClient != nil {
		crdBackends, err := l.combineByName(ctx)
		if err != nil {
			return nil, err
		}
		backends = crdBackends
	}
	for _, target := range l.aggregateTargets {
		backends = append(backends, target.Backends()...)
	}
	return backends, nil
}
```

(Adjust to match `combineByName`'s actual current signature — the Explore report shows it takes `manifests.Items, backends.Items` already fetched by the caller, so keep that shape; the sketch above assumes a small wrapper for readability, but do not introduce one gratuitously if it doesn't already exist — inline the existing `ListAll`/`combineByName` calls exactly as `Load` does today, just now guarded by `if l.routeBackendClient != nil`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./pkg/router/... -v -race`
Expected: PASS, including the Task 1 `NoTargetsConfigured` test (remove its `t.Skip` now) and every existing `cloud_router_test.go` case (the CRD-only path must be untouched).

- [ ] **Step 5: Commit**

```bash
git add pkg/router/cloud_router.go pkg/router/cloud_router_test.go
git commit -m "router: wire aggregate discovery targets into cloudLoader"
```

---

## Task 7: End-to-end test through `GrafanaRouter`

**Files:**
- Create: `pkg/router/aggregate_router_test.go`

**Interfaces:**
- Consumes: `NewGrafanaRouter`, `GrafanaRouter.Run`/`HandleFunc` (existing), everything from Tasks 1–6.

- [ ] **Step 1: Write the test**

```go
package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestGrafanaRouter_AggregatedGroupIsServedAndFiltered(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/apis":
			list := metav1.APIGroupList{Groups: []metav1.APIGroup{
				{Name: "dashboard.grafana.app"},
				{Name: "coordination.k8s.io"}, // must be filtered out by group_regex
			}}
			_ = json.NewEncoder(w).Encode(list)
		default:
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("proxied:" + r.URL.Path))
		}
	}))
	defer upstream.Close()

	target, err := newAggregateTarget(aggregateTargetConfig{
		Name:          "baas_apiserver",
		URL:           upstream.URL,
		GroupPatterns: []string{"*.grafana.app"},
	}, upstream.Client())
	require.NoError(t, err)
	target.pollInterval = 10 * time.Millisecond

	loader := &staticAggregateLoader{target: target} // small test-only RoutesLoader wrapping one aggregateTarget; see below
	r := NewGrafanaRouter(loader)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	require.NoError(t, r.Run(ctx))
	go target.run(ctx, loader.dirty)

	require.Eventually(t, func() bool { return r.KnownGroup("dashboard.grafana.app") }, 2*time.Second, 10*time.Millisecond)
	require.False(t, r.KnownGroup("coordination.k8s.io"))

	req := httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/things", nil)
	rec := httptest.NewRecorder()
	r.HandleFunc(rec, req, http.NotFoundHandler())
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), "proxied:/apis/dashboard.grafana.app/v1/things")
}

// staticAggregateLoader is a test-only RoutesLoader that reflects one
// aggregateTarget's live snapshot -- standing in for cloudLoader so this
// test exercises GrafanaRouter's reconcile/serve path against a real
// discovery-produced Backend without needing the full CRD machinery.
type staticAggregateLoader struct {
	target *aggregateTarget
	dirty  chan struct{}
}

func (l *staticAggregateLoader) Load(context.Context) ([]Backend, error) {
	return l.target.Backends(), nil
}
func (l *staticAggregateLoader) Notify(context.Context) (<-chan struct{}, error) {
	l.dirty = make(chan struct{}, 1)
	return l.dirty, nil
}
```

Follow whatever fake-`RoutesLoader` naming/comment convention `router_test.go`'s existing `stubLoader`/`staticLoader` already use — match that style rather than diverging.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./pkg/router/... -run TestGrafanaRouter_AggregatedGroup -v`
Expected: FAIL until the wiring above compiles and the poll has actually run at least once — first run should fail or hang if `Notify`'s channel isn't wired before `target.run` starts; fix ordering if so (call `loader.Notify` — indirectly via `r.Run`, which calls it — before starting `target.run`, or buffer appropriately).

- [ ] **Step 3: Fix any wiring issues found in Step 2, get it passing**

- [ ] **Step 4: Run full package test suite**

Run: `go test ./pkg/router/... -v -race`
Expected: PASS, all tests, including every pre-existing test in the package.

- [ ] **Step 5: Commit**

```bash
git add pkg/router/aggregate_router_test.go
git commit -m "router: end-to-end test for aggregated group discovery and serving"
```

---

## Task 8: Documentation — AGENTS.md amendment + design spec

**Files:**
- Modify: `pkg/router/AGENTS.md`
- Create: `pkg/router/specs/2026-09-11-router-aggregate-discovery-design.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Amend the "Passive circuit breaking" section**

Read the full current section (quoted in full in the earlier research pass) and add a clearly delimited subsection immediately after it, e.g.:

```markdown
### Active discovery is a different concern from passive health

The decision above is about *health* — whether a group's backend is serving well right now, and
whether that should gate `/apis`/`/openapi/v3`. It says nothing about *discovery* — learning which
groups exist in the first place. `forward` backends get discovery for free from a `RouteBackend` CR;
the two fixed aggregate targets (`baas_apiserver`, `cloud_app_platform_apiserver`, `aggregate_*.go`)
have no CR, so the router polls their `/apis` endpoint on a cooldown-paced background loop to learn
their group list. That poll result only ever changes *which groups are installed* — the same
`r.served`-sourced discovery synthesis and the same per-group `gobreaker` breaker apply to an
aggregate-discovered group exactly as they do to a forward one; nothing here reintroduces
kube-aggregator's `AvailabilityController`-style active health gating that the section above rejects.
```

- [ ] **Step 2: Document the new config keys**

Near wherever `apiserver_url`/`cap_token` are documented, add the renamed key and the two new namespaced key groups, e.g.:

```markdown
Keys under `[cloud_router]`:
- `appmanifest_apiserver_url` (renamed from `apiserver_url`) -- gates the CRD-backed forward-route loader.
- `cap_token`, `token_exchange_url` -- shared across appmanifest and both aggregate targets.
- `apiserver_ca_file`, `apiserver_insecure` -- TLS options, scoped to `appmanifest_apiserver_url` only.
- `baas_apiserver.url`, `baas_apiserver.audience`, `baas_apiserver.group_regex` (optional, comma-separated glob patterns; unset means aggregate every group).
- `cloud_app_platform_apiserver.url`, `cloud_app_platform_apiserver.audience`, `cloud_app_platform_apiserver.group_regex` (same shape as baas_apiserver).
- The two aggregate targets activate independently of `appmanifest_apiserver_url` -- CRDs are not required for aggregate discovery.
```

- [ ] **Step 3: Write the design doc**

Write `pkg/router/specs/2026-09-11-router-aggregate-discovery-design.md` following the structure of the two existing docs in that directory (read both first for section headings/tone). Cover: problem statement (two fixed upstream apiservers with no CR, need their groups surfaced), why active discovery is required here but health stays passive (cross-reference AGENTS.md's amended section), the cooldown/backoff design and why it's a plain backoff rather than a second `gobreaker` breaker, the fixed-two-targets-not-a-dynamic-list decision, and the explicitly out-of-scope follow-ups (per-target TLS/CA config, configurable poll interval).

- [ ] **Step 4: Commit**

```bash
git add pkg/router/AGENTS.md pkg/router/specs/2026-09-11-router-aggregate-discovery-design.md
git commit -m "router: document active discovery for aggregate apiservers"
```

---

## Self-Review Notes

- **Spec coverage:** rename (Task 1), config parsing incl. optional regex shortlist (Task 2), cooldown so a downed apiserver isn't spammed (Task 3, the user's explicit ask), actual discovery + proxying (Task 4), tying poll+filter+cooldown together (Task 5), independence from the CRD/appmanifest connection (Task 6), proof it works end-to-end through the real router (Task 7), and reconciling with the standing "passive-only" AGENTS.md decision in writing (Task 8) — every explicit requirement from the conversation has a task.
- **Type consistency check:** `aggregateTargetConfig` (Task 2) is consumed unchanged by `newAggregateTarget` (Task 5) and by Task 6's factory loop; `aggregateTarget.Backends() []Backend` (Task 5) is consumed unchanged by `cloudLoader.Load()` (Task 6) and the Task 7 test's `staticAggregateLoader`. `Backend`'s three methods (`Key`, `Group`, `Load`) are implemented identically in shape by `aggregateBackend` (Task 4) and pre-existing `forwardBackend` — no drift.
- **Open item flagged, not silently assumed:** the exact real-world type of `cfg.SectionWithEnvOverrides(...)`'s return value and its `Key(...)` method signature (`aggregateSectionReader` in Task 2) is called out explicitly as something to confirm against the real `setting` package before trusting the interface — this plan intentionally does not guess a Grafana-internal type it wasn't shown, and neither should whoever executes Task 2.
