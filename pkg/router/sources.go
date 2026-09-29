package router

import (
	"sync/atomic"
	"time"
)

// Route sources, as reported by Backend.Source.
const (
	sourceRouteBackend  = "routebackend"
	sourceSingleTenant  = "single-tenant"
	sourcePluginsURL    = "plugins_url"
	sourceLocalPlugin   = "local-plugin"
	sourceDummy         = "dummy"
	aggregateSourceName = "aggregate:"
)

func aggregateSource(target string) string { return aggregateSourceName + target }

// sourceStatus is how a route source's loads or polls are going.
type sourceStatus struct {
	Source string
	// LastSuccess is when the source last loaded successfully; zero if never.
	LastSuccess time.Time
	// Successes and Failures count attempts since the router started.
	Successes uint64
	Failures  uint64
}

// shadowedGroup is a group that one source offered but a higher-priority
// source serves instead.
type shadowedGroup struct {
	Group  string
	Source string
	By     string
}

// loaderStatus is an optional RoutesLoader interface for loaders that report
// on their sources.
type loaderStatus interface {
	sourceStatuses() []sourceStatus
	shadowedGroups() []shadowedGroup
	// stackLookups counts single-tenant stack lookups by result; nil without
	// a single-tenant fallback.
	stackLookups() map[string]uint64
}

// pollStatus records the outcome of a source's loads. Safe for concurrent use.
type pollStatus struct {
	lastSuccess atomic.Int64 // Unix nanoseconds; zero if never
	successes   atomic.Uint64
	failures    atomic.Uint64
}

func (p *pollStatus) recordSuccess(now time.Time) {
	p.lastSuccess.Store(now.UnixNano())
	p.successes.Add(1)
}

func (p *pollStatus) recordFailure() {
	p.failures.Add(1)
}

func (p *pollStatus) status(source string) sourceStatus {
	s := sourceStatus{Source: source, Successes: p.successes.Load(), Failures: p.failures.Load()}
	if ns := p.lastSuccess.Load(); ns != 0 {
		s.LastSuccess = time.Unix(0, ns).UTC()
	}
	return s
}
