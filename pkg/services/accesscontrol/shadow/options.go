package shadow

import "context"

type RunOption func(*runOptions)

type runOptions struct {
	skip func(context.Context) SkipReason
}

// WithSkip checks the original context before acquiring capacity or preparing
// work. An empty reason allows shadowing. The policy applies only to this Run;
// without it, admission is limited only by capacity.
func WithSkip(check func(context.Context) SkipReason) RunOption {
	return func(options *runOptions) { options.skip = check }
}
