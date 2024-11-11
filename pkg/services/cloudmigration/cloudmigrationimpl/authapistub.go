package cloudmigrationimpl

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/authapi"
	"github.com/grafana/grafana/pkg/util"
)

type authapiStub struct {
	// The cloud migration token created by this stub.
	token    *authapi.TokenView
	policies map[string]authapi.AccessPolicy
}

func (client *authapiStub) CreateAccessPolicy(_ context.Context, _ authapi.CreateAccessPolicyParams, _ authapi.CreateAccessPolicyPayload) (authapi.AccessPolicy, error) {
	randStr := fmt.Sprintf("random-policy-%s", util.GenerateShortUID())
	policy := authapi.AccessPolicy{
		ID:   randStr,
		Name: randStr,
	}
	client.policies[policy.ID] = policy
	return policy, nil
}

func (client *authapiStub) DeleteAccessPolicy(_ context.Context, params authapi.DeleteAccessPolicyParams) (bool, error) {
	delete(client.policies, params.AccessPolicyID)
	return true, nil
}

func (client *authapiStub) ListAccessPolicies(_ context.Context, _ authapi.ListAccessPoliciesParams) ([]authapi.AccessPolicy, error) {
	items := make([]authapi.AccessPolicy, 0)
	for _, v := range client.policies {
		items = append(items, v)
	}
	return items, nil
}

func (client *authapiStub) ListTokens(_ context.Context, _ authapi.ListTokenParams) ([]authapi.TokenView, error) {
	if client.token == nil {
		return []authapi.TokenView{}, nil
	}

	return []authapi.TokenView{*client.token}, nil
}

func (client *authapiStub) CreateToken(_ context.Context, _ authapi.CreateTokenParams, payload authapi.CreateTokenPayload) (authapi.Token, error) {
	token := authapi.Token{
		ID:             fmt.Sprintf("random-token-%s", util.GenerateShortUID()),
		Name:           payload.Name,
		AccessPolicyID: payload.AccessPolicyID,
		Token:          fmt.Sprintf("completely_fake_token_%s", util.GenerateShortUID()),
	}
	client.token = &authapi.TokenView{
		ID:             token.ID,
		Name:           token.Name,
		AccessPolicyID: token.AccessPolicyID,
		DisplayName:    token.Name,
	}
	return token, nil
}

func (client *authapiStub) DeleteToken(_ context.Context, _ authapi.DeleteTokenParams) error {
	client.token = nil
	return nil
}
