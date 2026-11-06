package legacyclient

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var _ LegacyAccessClient = (*LegacyClient)(nil)

// LegacyCheck executes the deprecated legacy-RBAC compatibility check through
// the local AuthZ compatibility API.
func (c *LegacyClient) LegacyCheck(ctx context.Context, req LegacyCheckRequest) (allowed bool, err error) {
	ctx, span := c.tracer.Start(ctx, "LegacyClient.LegacyCheck")
	defer func() {
		if err != nil {
			_ = tracing.Error(span, err)
		}

		span.SetAttributes(attribute.Bool("allowed", allowed))
		span.End()
	}()

	if c.clientV1 == nil {
		return false, errors.New("legacy check client is not configured")
	}

	expression, err := accesscontrol.ToLegacyExpression(req.Evaluator)
	if err != nil {
		return false, fmt.Errorf("converting evaluator to legacy expression: %w", err)
	}

	var restriction *authzextv1.LegacyActionRestriction
	if req.Restriction != nil {
		restriction = &authzextv1.LegacyActionRestriction{Actions: slices.Clone(req.Restriction.Actions)}
	}

	var internal *authzextv1.LegacyInternalIdentity
	if req.InternalIdentity != nil {
		internal = &authzextv1.LegacyInternalIdentity{Profile: req.InternalIdentity.Profile.String()}

		if background := req.InternalIdentity.Background; background != nil {
			permissions := make(map[string]*authzextv1.LegacyPermissionScopes, len(background.Permissions))
			for action, scopes := range background.Permissions {
				permissions[action] = &authzextv1.LegacyPermissionScopes{Scopes: slices.Clone(scopes)}
			}

			internal.Background = &authzextv1.LegacyBackgroundIdentity{
				Name:        background.Name,
				OrgRole:     background.OrgRole,
				Permissions: permissions,
			}
		}
	}

	//nolint:staticcheck // We intentionally call the deprecated compatibility API.
	resp, err := c.clientV1.LegacyCheck(ctx, &authzextv1.LegacyCheckRequest{
		Namespace:           req.Namespace,
		RequesterOrgId:      req.RequesterOrgID,
		Subject:             req.Subject,
		Expression:          expression,
		Teams:               slices.Clone(req.Teams),
		SkipCache:           req.SkipCache,
		SkipScopeResolution: req.SkipScopeResolution,
		InternalIdentity:    internal,
		Restriction:         restriction,
	})
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
