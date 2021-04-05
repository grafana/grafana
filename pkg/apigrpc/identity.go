package apigrpc

import "context"

type identityMDKey struct{}

type IdentityType int

const (
	IdentityTypeUser       = 0
	IdentityTypeDatasource = 1
)

type UserIdentity struct {
	ID int64
}

type DatasourceIdentity struct {
	UID string
}

// Identity is an information about request issuer.
type Identity struct {
	Type               IdentityType
	UserIdentity       *UserIdentity
	DatasourceIdentity *DatasourceIdentity
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
