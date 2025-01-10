package fake

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/authapi"
)

var _ authapi.Service = (*AuthapiStub)(nil)

type AuthapiStub struct {
	// The cloud migration token created by this stub.
	Token    *authapi.TokenView
	Policies map[string]authapi.AccessPolicy
}

func (client *AuthapiStub) CreateAccessPolicy(_ context.Context, _ authapi.CreateAccessPolicyParams, payload authapi.CreateAccessPolicyPayload) (authapi.AccessPolicy, error) {
	// randStr := fmt.Sprintf("random-policy-%s", util.GenerateShortUID())
	randStr := fmt.Sprintf("random-policy-%s", payload.Name)
	policy := authapi.AccessPolicy{
		ID:   randStr,
		Name: randStr,
	}
	client.Policies[policy.ID] = policy
	return policy, nil
}

func (client *AuthapiStub) DeleteAccessPolicy(_ context.Context, params authapi.DeleteAccessPolicyParams) (bool, error) {
	delete(client.Policies, params.AccessPolicyID)
	return true, nil
}

func (client *AuthapiStub) ListAccessPolicies(_ context.Context, _ authapi.ListAccessPoliciesParams) ([]authapi.AccessPolicy, error) {
	items := make([]authapi.AccessPolicy, 0)
	for _, v := range client.Policies {
		items = append(items, v)
	}
	return items, nil
}

func (client *AuthapiStub) ListTokens(_ context.Context, _ authapi.ListTokenParams) ([]authapi.TokenView, error) {
	if client.Token == nil {
		return []authapi.TokenView{}, nil
	}

	return []authapi.TokenView{*client.Token}, nil
}

func (client *AuthapiStub) CreateToken(_ context.Context, _ authapi.CreateTokenParams, payload authapi.CreateTokenPayload) (authapi.Token, error) {
	token := authapi.Token{
		// ID:             fmt.Sprintf("random-token-%s", util.GenerateShortUID()),
		ID:             fmt.Sprintf("random-token-%s", payload.Name),
		Name:           payload.Name,
		AccessPolicyID: payload.AccessPolicyID,
		Token:          fmt.Sprintf("completely_fake_token_%s", payload.Name),
	}
	client.Token = &authapi.TokenView{
		ID:             token.ID,
		Name:           token.Name,
		AccessPolicyID: token.AccessPolicyID,
		DisplayName:    token.Name,
	}
	return token, nil
}

func (client *AuthapiStub) DeleteToken(_ context.Context, _ authapi.DeleteTokenParams) error {
	client.Token = nil
	return nil
}
