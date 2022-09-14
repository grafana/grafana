package log

import "context"

type contextualArgsContextKey struct{}

var contextualArgsKey = contextualArgsContextKey{}

type contextualArguments struct {
	args []interface{}
}

// WithContextualArgs adds the key/value arguments to the provided context.
func WithContextualArgs(ctx context.Context, args ...interface{}) context.Context {
	ctxArgs := contextualArgs(ctx)
	if ctxArgs == nil {
		ctxArgs = &contextualArguments{
			args: []interface{}{},
		}
	}

	ctxArgs.args = append(ctxArgs.args, args...)

	return context.WithValue(ctx, contextualArgsKey, ctxArgs)
}

func contextualArgs(ctx context.Context) *contextualArguments {
	val := ctx.Value(contextualArgsKey)
	if val != nil {
		if args, ok := val.(*contextualArguments); ok {
			return args
		}
	}

	return nil
}
