package authn

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
)

type TokenAuthorizer struct {
	// ????
}

func (t *TokenAuthorizer) AuthenticateToken(ctx context.Context, token string) (types.AuthInfo, error) {
	return nil, fmt.Errorf("TODO!!!!")
}
