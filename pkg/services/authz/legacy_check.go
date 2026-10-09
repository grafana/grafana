package authz

import (
	"context"
	"errors"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// LegacyCheck executes the deprecated legacy-RBAC compatibility check through
// the local AuthZ compatibility API.
func LegacyCheck(ctx context.Context, client authzextv1.LegacyAuthzServiceClient, req *authzextv1.LegacyCheckRequest) (bool, error) {
	if client == nil {
		return false, errors.New("legacy check client is not configured")
	}
	//nolint:staticcheck // We intentionally call the deprecated compatibility API.
	resp, err := client.LegacyCheck(ctx, req)
	if err != nil {
		return false, err
	}
	if resp.GetError() != "" {
		return false, errors.New(resp.GetError())
	}
	return resp.GetAllowed(), nil
}
