package cloudmigrationimpl

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/services/gcom"
	"github.com/grafana/grafana/pkg/util"
)

type gcomStub struct {
	// The cloud migration token created by this stub.
	token    *gcom.TokenView
	policies map[string]gcom.AccessPolicy
}

func (client *gcomStub) GetInstanceByID(ctx context.Context, requestID string, instanceID string) (gcom.Instance, error) {
	id, err := strconv.Atoi(instanceID)
	if err != nil {
		return gcom.Instance{}, fmt.Errorf("parsing instanceID: %w", err)
	}
	return gcom.Instance{
		ID:          id,
		Slug:        "stubinstance",
		RegionSlug:  "fake-region",
		ClusterSlug: "fake-cluser",
	}, nil
}

func (client *gcomStub) CreateAccessPolicy(ctx context.Context, params gcom.CreateAccessPolicyParams, payload gcom.CreateAccessPolicyPayload) (gcom.AccessPolicy, error) {
	randStr := fmt.Sprintf("random-policy-%s", util.GenerateShortUID())
	policy := gcom.AccessPolicy{
		ID:   randStr,
		Name: randStr,
	}
	client.policies[policy.ID] = policy
	return policy, nil
}

func (client *gcomStub) DeleteAccessPolicy(ctx context.Context, params gcom.DeleteAccessPolicyParams) (bool, error) {
	delete(client.policies, params.AccessPolicyID)
	return true, nil
}

func (client *gcomStub) ListAccessPolicies(ctx context.Context, params gcom.ListAccessPoliciesParams) ([]gcom.AccessPolicy, error) {
	items := make([]gcom.AccessPolicy, 0)
	for _, v := range client.policies {
		items = append(items, v)
	}
	return items, nil
}

func (client *gcomStub) ListTokens(ctx context.Context, params gcom.ListTokenParams) ([]gcom.TokenView, error) {
	if client.token == nil {
		return []gcom.TokenView{}, nil
	}

	return []gcom.TokenView{*client.token}, nil
}

func (client *gcomStub) CreateToken(ctx context.Context, params gcom.CreateTokenParams, payload gcom.CreateTokenPayload) (gcom.Token, error) {
	token := gcom.Token{
		ID:             fmt.Sprintf("random-token-%s", util.GenerateShortUID()),
		Name:           payload.Name,
		AccessPolicyID: payload.AccessPolicyID,
		Token:          fmt.Sprintf("completely_fake_token_%s", util.GenerateShortUID()),
	}
	client.token = &gcom.TokenView{
		ID:             token.ID,
		Name:           token.Name,
		AccessPolicyID: token.AccessPolicyID,
		DisplayName:    token.Name,
	}
	return token, nil
}

func (client *gcomStub) DeleteToken(ctx context.Context, params gcom.DeleteTokenParams) error {
	client.token = nil
	return nil
}
