package router

import (
	"sync/atomic"
	"time"
)

// Route sources, as reported by Backend.Source.
const (
	sourceSingleTenant  = "single-tenant"
	sourcePluginsURL    = "plugins_url"
	sourceCoreURL       = "core_url"
	sourceLocalPlugin   = "local-plugin"
	sourceDev           = "dev"
	sourceExternal      = "external"
	aggregateSourceName = "aggregate:"
)

func aggregateSource(target string) string { return aggregateSourceName + target }

// sourceStatus is how a route source's loads or polls are going.
type sourceStatus struct {
	Source string `json:"source"`
	// LastSuccess is when the source last loaded successfully; zero if never.
	LastSuccess time.Time `json:"lastSuccess"`
	// Successes and Failures count attempts since the router started.
	Successes uint64 `json:"successes"`
	Failures  uint64 `json:"failures"`
	// Skipped is the number of backends the latest successful load skipped.
	Skipped int `json:"skipped"`
}

// shadowedGroup is a group that one source offered but a higher-priority
// source serves instead. The single-tenant fallback is never reported, since
// every other source is meant to override it.
type shadowedGroup struct {
	Group  string `json:"group"`
	Source string `json:"source"`
	By     string `json:"servedBy"`
}

// loaderStatus is an optional RoutesLoader interface for loaders that report
// on their sources.
type loaderStatus interface {
	sourceStatuses() []sourceStatus
	shadowedGroups() []shadowedGroup
	// stackLookups counts single-tenant stack lookups by result; nil without
	// a single-tenant fallback.
	stackLookups() map[string]uint64
	// stackDiscoveryCache counts single-tenant discovery cache lookups by
	// result; nil without a single-tenant fallback or its discovery cache.
	stackDiscoveryCache() map[string]uint64
}

// pollStatus records the outcome of a source's loads. Safe for concurrent use.
type pollStatus struct {
	lastSuccess atomic.Int64 // Unix nanoseconds; zero if never
	successes   atomic.Uint64
	failures    atomic.Uint64
	skipped     atomic.Int64
}

// recordSuccess records a successful attempt, and reports whether it was the
// source's first attempt (see recordFailure). Call it only once the attempt's
// snapshot is stored: the cloud loader serves a source once it has polled,
// and must then see the source's groups.
func (p *pollStatus) recordSuccess(now time.Time) (first bool) {
	p.lastSuccess.Store(now.UnixNano())
	return p.successes.Add(1) == 1 && p.failures.Load() == 0
}

// recordFailure records a failed attempt, and reports whether it was the
// source's first attempt: the first attempt ends the cloud loader's pending
// state, failed or not, so its poll loop wakes the router for it.
func (p *pollStatus) recordFailure() (first bool) {
	return p.failures.Add(1) == 1 && p.successes.Load() == 0
}

// wake asks the router to reconcile, coalescing with a wake already pending.
func wake(dirty chan<- struct{}) {
	select {
	case dirty <- struct{}{}:
	default:
	}
}

// recordSkipped records how many backends the latest load skipped.
func (p *pollStatus) recordSkipped(skipped int) {
	p.skipped.Store(int64(skipped))
}

func (p *pollStatus) status(source string) sourceStatus {
	s := sourceStatus{Source: source, Successes: p.successes.Load(), Failures: p.failures.Load(), Skipped: int(p.skipped.Load())}
	if ns := p.lastSuccess.Load(); ns != 0 {
		s.LastSuccess = time.Unix(0, ns).UTC()
	}
	return s
}
