package leaderelection

import "context"

// RunOption customises the behaviour of Elector.Run.
type RunOption func(*RunOptions)

// RunOptions holds the resolved options for an Elector.Run call. Electors
// outside this package use ResolveRunOptions to apply RunOption values.
type RunOptions struct {
	ReleaseOnCancel  bool
	OnStartedLeading func(ctx context.Context)
	OnStoppedLeading func()
	OnNewLeader      func(identity string)
}

// ResolveRunOptions applies the supplied options on top of the given
// defaults and returns the resolved RunOptions. Callers are expected to
// pass the elector-specific defaults first so user-provided opts override
// them.
func ResolveRunOptions(defaults, opts []RunOption) *RunOptions {
	o := &RunOptions{}
	for _, opt := range defaults {
		opt(o)
	}
	for _, opt := range opts {
		opt(o)
	}
	return o
}

// WithReleaseOnCancel controls whether leadership is released when the
// context is cancelled. Default: true.
func WithReleaseOnCancel(release bool) RunOption {
	return func(o *RunOptions) {
		o.ReleaseOnCancel = release
	}
}

// WithOnStartedLeading sets a callback invoked (before fn) when leadership is
// acquired. Default: logs the acquisition.
func WithOnStartedLeading(cb func(ctx context.Context)) RunOption {
	return func(o *RunOptions) {
		o.OnStartedLeading = cb
	}
}

// WithOnStoppedLeading sets a callback invoked when leadership is lost.
// Default: logs the loss.
func WithOnStoppedLeading(cb func()) RunOption {
	return func(o *RunOptions) {
		o.OnStoppedLeading = cb
	}
}

// WithOnNewLeader sets a callback invoked when a new leader is observed.
// Default: logs if the new leader is a different identity.
func WithOnNewLeader(cb func(identity string)) RunOption {
	return func(o *RunOptions) {
		o.OnNewLeader = cb
	}
}
