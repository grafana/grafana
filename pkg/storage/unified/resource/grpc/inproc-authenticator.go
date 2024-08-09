package grpc

import (
	"context"
	"fmt"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type InProcAuthenticator struct{}

func (f *InProcAuthenticator) Authenticate(ctx context.Context) (context.Context, error) {
	r, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	idClaims := r.GetIDClaims()
	if idClaims == nil {
		return nil, fmt.Errorf("no id claims found")
	}

	callerAuthInfo := authnlib.CallerAuthInfo{IDTokenClaims: idClaims}
	return authnlib.AddCallerAuthInfoToContext(ctx, callerAuthInfo), nil
}
