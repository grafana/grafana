package secret

import (
	"context"

	"github.com/grafana/authlib/claims"
)

type authorizer struct {
	// TODO!!!
}

func (a *authorizer) OnCreate(ctx context.Context, auth claims.AuthInfo, namespace string, name string) error {
	return nil
}

func (a *authorizer) OnUpdate(ctx context.Context, auth claims.AuthInfo, row *secureValueRow, old *secureValueRow) error {
	return nil
}

func (a *authorizer) OnDelete(ctx context.Context, auth claims.AuthInfo, row *secureValueRow) error {
	return nil
}

func (a *authorizer) CanView(ctx context.Context, auth claims.AuthInfo, row *secureValueRow) bool {
	return true
}

func (a *authorizer) CanDecrypt(ctx context.Context, auth claims.AuthInfo, row *secureValueRow) bool {
	return true
}
