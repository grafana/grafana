package apigrpc

import "context"

type identityMDKey struct{}

type IdentityType int

const (
	IdentityTypeUser   = 0
	IdentityTypePlugin = 1
)

type UserIdentity struct {
	UserID int64
}

type PluginIdentity struct {
	PluginID string
}

// Identity is an information about request issuer.
type Identity struct {
	Type           IdentityType
	UserIdentity   *UserIdentity
	PluginIdentity *PluginIdentity
}

// GetIdentity can be used to extract request Identity stored in a context.
func GetIdentity(ctx context.Context) (*Identity, bool) {
	identityMD := ctx.Value(identityMDKey{})
	md, ok := identityMD.(*Identity)
	if !ok {
		return nil, false
	}
	return md, true
}

func SetIdentity(ctx context.Context, identity *Identity) context.Context {
	return context.WithValue(ctx, identityMDKey{}, identity)
}
