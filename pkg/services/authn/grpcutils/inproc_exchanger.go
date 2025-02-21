package grpcutils

import (
	"context"
	"encoding/base64"
	"encoding/json"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type inProcExchanger struct {
	tokenResponse *authn.TokenExchangeResponse
}

func ProvideInProcExchanger() authn.StaticTokenExchanger {
	token, err := createInProcToken()
	if err != nil {
		panic(err)
	}

	return authn.NewStaticTokenExchanger(token)
}

func (e *inProcExchanger) Exchange(ctx context.Context, r authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	return e.tokenResponse, nil
}

func createInProcToken() (string, error) {
	claims := authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Audience: []string{"resourceStore"},
			Issuer:   "grafana",
			Subject:  types.NewTypeID(types.TypeAccessPolicy, "grafana"),
		},
		Rest: authn.AccessTokenClaims{
			Namespace:            "*",
			Permissions:          identity.ServiceIdentityClaims.Rest.Permissions,
			DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
		},
	}

	header, err := json.Marshal(map[string]string{
		"alg": "none",
		"typ": authn.TokenTypeAccess,
	})
	if err != nil {
		return "", err
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload) + ".", nil
}
