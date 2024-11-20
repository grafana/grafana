package authapi

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/util"
)

var _ Service = (*AuthapiStub)(nil)

type AuthapiStub struct {
	// The cloud migration token created by this stub.
	Token    *TokenView
	Policies map[string]AccessPolicy
}

func (client *AuthapiStub) CreateAccessPolicy(_ context.Context, _ CreateAccessPolicyParams, _ CreateAccessPolicyPayload) (AccessPolicy, error) {
	randStr := fmt.Sprintf("random-policy-%s", util.GenerateShortUID())
	policy := AccessPolicy{
		ID:   randStr,
		Name: randStr,
	}
	client.Policies[policy.ID] = policy
	return policy, nil
}

func (client *AuthapiStub) DeleteAccessPolicy(_ context.Context, params DeleteAccessPolicyParams) (bool, error) {
	delete(client.Policies, params.AccessPolicyID)
	return true, nil
}

func (client *AuthapiStub) ListAccessPolicies(_ context.Context, _ ListAccessPoliciesParams) ([]AccessPolicy, error) {
	items := make([]AccessPolicy, 0)
	for _, v := range client.Policies {
		items = append(items, v)
	}
	return items, nil
}

func (client *AuthapiStub) ListTokens(_ context.Context, _ ListTokenParams) ([]TokenView, error) {
	if client.Token == nil {
		return []TokenView{}, nil
	}

	return []TokenView{*client.Token}, nil
}

func (client *AuthapiStub) CreateToken(_ context.Context, _ CreateTokenParams, payload CreateTokenPayload) (Token, error) {
	token := Token{
		ID:             fmt.Sprintf("random-token-%s", util.GenerateShortUID()),
		Name:           payload.Name,
		AccessPolicyID: payload.AccessPolicyID,
		Token:          fmt.Sprintf("completely_fake_token_%s", util.GenerateShortUID()),
	}
	client.Token = &TokenView{
		ID:             token.ID,
		Name:           token.Name,
		AccessPolicyID: token.AccessPolicyID,
		DisplayName:    token.Name,
	}
	return token, nil
}

func (client *AuthapiStub) DeleteToken(_ context.Context, _ DeleteTokenParams) error {
	client.Token = nil
	return nil
}
