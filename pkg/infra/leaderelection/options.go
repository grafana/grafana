package leaderelection

import "context"

// RunOption customises the behaviour of Elector.Run.
type RunOption func(*runOptions)

type runOptions struct {
	releaseOnCancel  bool
	onStartedLeading func(ctx context.Context)
	onStoppedLeading func()
	onNewLeader      func(identity string)
}

// WithReleaseOnCancel controls whether leadership is released when the
// context is cancelled. Default: true.
func WithReleaseOnCancel(release bool) RunOption {
	return func(o *runOptions) {
		o.releaseOnCancel = release
	}
}

// WithOnStartedLeading sets a callback invoked (before fn) when leadership is
// acquired. Default: logs the acquisition.
func WithOnStartedLeading(cb func(ctx context.Context)) RunOption {
	return func(o *runOptions) {
		o.onStartedLeading = cb
	}
}

// WithOnStoppedLeading sets a callback invoked when leadership is lost.
// Default: logs the loss.
func WithOnStoppedLeading(cb func()) RunOption {
	return func(o *runOptions) {
		o.onStoppedLeading = cb
	}
}

// WithOnNewLeader sets a callback invoked when a new leader is observed.
// Default: logs if the new leader is a different identity.
func WithOnNewLeader(cb func(identity string)) RunOption {
	return func(o *runOptions) {
		o.onNewLeader = cb
	}
}
