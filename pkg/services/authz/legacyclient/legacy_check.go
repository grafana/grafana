package legacyclient

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// LegacyCheck executes the deprecated legacy-RBAC compatibility check through
// the local AuthZ compatibility API.
func (c *LegacyClient) LegacyCheck(ctx context.Context, req *authzextv1.LegacyCheckRequest) (allowed bool, err error) {
	ctx, span := c.tracer.Start(ctx, "LegacyClient.LegacyCheck")
	defer func() {
		if err != nil {
			span.RecordError(err)
		}

		span.End()
	}()

	if c.clientV1 == nil {
		return false, errors.New("legacy check client is not configured")
	}

	//nolint:staticcheck // We intentionally call the deprecated compatibility API.
	resp, err := c.clientV1.LegacyCheck(ctx, req)
	if err != nil {
		return false, err
	}

	if resp == nil {
		return false, errors.New("legacy check returned no response")
	}

	switch resp.GetErrorCode() {
	case authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_SCOPE_RESOURCE_NOT_FOUND:
		return false, accesscontrol.ErrScopeResourceNotFound.Errorf("%s", resp.GetError())
	case authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_UNSPECIFIED:
	default:
		return false, fmt.Errorf("legacy check failed with error code %d: %s", resp.GetErrorCode(), resp.GetError())
	}

	if resp.GetError() != "" {
		return false, errors.New(resp.GetError())
	}

	return resp.GetAllowed(), nil
}
