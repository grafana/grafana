package secret

import (
	"context"

	"github.com/grafana/authlib/claims"
)

type authorizer struct {
	// TODO!!!
}

// TODO: why not `CanCreate`?
func (a *authorizer) OnCreate(ctx context.Context, auth claims.AuthInfo, namespace string, name string) error {
	return nil
}

func (a *authorizer) OnUpdate(ctx context.Context, auth claims.AuthInfo, row *secureValueRow, old *secureValueRow) error {
	return nil
}

func (a *authorizer) OnDelete(ctx context.Context, auth claims.AuthInfo, row *secureValueRow) error {
	return nil
}

// Can view the securevalue exists at all, and does not include the raw value, see `CanDecrypt`.
func (a *authorizer) CanView(ctx context.Context, auth claims.AuthInfo, row *secureValueRow) bool {
	return true
}

func (a *authorizer) CanDecrypt(ctx context.Context, auth claims.AuthInfo, row *secureValueRow) bool {
	return true
}
