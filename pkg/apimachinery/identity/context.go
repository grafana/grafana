package identity

import (
	"context"
	"fmt"
	"reflect"

	claims "github.com/grafana/authlib/types"
)

type ctxUserKey struct{}

// WithRequester attaches the requester to the context.
func WithRequester(ctx context.Context, usr Requester) context.Context {
	ctx = claims.WithAuthInfo(ctx, usr) // also set the upstream auth info claims
	return context.WithValue(ctx, ctxUserKey{}, usr)
}

// Get the Requester from context
func GetRequester(ctx context.Context) (Requester, error) {
	// Set by appcontext.WithUser
	u, ok := ctx.Value(ctxUserKey{}).(Requester)
	if ok && !checkNilRequester(u) {
		return u, nil
	}
	return nil, fmt.Errorf("a Requester was not found in the context")
}

func checkNilRequester(r Requester) bool {
	return r == nil || (reflect.ValueOf(r).Kind() == reflect.Ptr && reflect.ValueOf(r).IsNil())
}
