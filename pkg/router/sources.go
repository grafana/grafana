package router

import (
	"sync/atomic"
	"time"
)

// Route sources, as reported in BackendDescription.Source.
const (
	sourceRouteBackend  = "routebackend"
	sourceSingleTenant  = "single-tenant"
	sourcePluginsURL    = "plugins_url"
	sourceLocalPlugin   = "local-plugin"
	sourceDummy         = "dummy"
	sourceUnknown       = "unknown"
	aggregateSourceName = "aggregate:"
)

func aggregateSource(target string) string { return aggregateSourceName + target }

// describeBackend describes b, or reports an unknown source for a backend that
// doesn't describe itself.
func describeBackend(b Backend) BackendDescription {
	if d, ok := b.(DescribedBackend); ok {
		return d.Describe()
	}
	return BackendDescription{Source: sourceUnknown}
}

// sourceStatus is how a route source's loads or polls are going.
type sourceStatus struct {
	Source string `json:"source"`
	// LastSuccess is when the source last loaded successfully; zero if never.
	LastSuccess time.Time `json:"lastSuccess"`
	// LastError is the latest attempt's error; empty if it succeeded.
	LastError string `json:"lastError,omitempty"`
	// Successes and Failures count attempts since the router started.
	Successes uint64 `json:"successes"`
	Failures  uint64 `json:"failures"`
}

// shadowedGroup is a group that one source offered but a higher-priority
// source serves instead.
type shadowedGroup struct {
	Group  string `json:"group"`
	Source string `json:"source"`
	By     string `json:"by"`
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
	lastError   atomic.Pointer[string]
	successes   atomic.Uint64
	failures    atomic.Uint64
}

func (p *pollStatus) recordSuccess(now time.Time) {
	p.lastSuccess.Store(now.UnixNano())
	p.lastError.Store(nil)
	p.successes.Add(1)
}

func (p *pollStatus) recordFailure(err error) {
	msg := err.Error()
	p.lastError.Store(&msg)
	p.failures.Add(1)
}

func (p *pollStatus) status(source string) sourceStatus {
	s := sourceStatus{Source: source, Successes: p.successes.Load(), Failures: p.failures.Load()}
	if ns := p.lastSuccess.Load(); ns != 0 {
		s.LastSuccess = time.Unix(0, ns).UTC()
	}
	if msg := p.lastError.Load(); msg != nil {
		s.LastError = *msg
	}
	return s
}
