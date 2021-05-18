package apiserver

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authtoken"
)

type identityMDKey struct{}

// GetIdentity can be used to extract request Identity stored in a context.
func GetIdentity(ctx context.Context) (*authtoken.Identity, bool) {
	identityMD := ctx.Value(identityMDKey{})
	md, ok := identityMD.(*authtoken.Identity)
	if !ok {
		return nil, false
	}
	return md, true
}

func SetIdentity(ctx context.Context, identity *authtoken.Identity) context.Context {
	return context.WithValue(ctx, identityMDKey{}, identity)
}
