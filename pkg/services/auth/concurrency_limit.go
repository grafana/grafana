package auth

import (
	"github.com/grafana/grafana/pkg/registry"
)

func init() {
	registry.RegisterService(&NoConcurrencyLimits{})
}

type ConcurrencyLimit interface {
	// ConcurrentSessionsAreLimited is true if concurrent sessions are limited by a maximum number
	ConcurrentSessionsAreLimited() bool

	// MaxConcurrentSessions returns the maximum number of concurrent sessions per user
	MaxConcurrentSessions() int
}

type NoConcurrencyLimits struct{}

func (*NoConcurrencyLimits) Init() error {
	return nil
}

func (*NoConcurrencyLimits) ConcurrentSessionsAreLimited() bool {
	return false
}

func (*NoConcurrencyLimits) MaxConcurrentSessions() int {
	return 0
}
