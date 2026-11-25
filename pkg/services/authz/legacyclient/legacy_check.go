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
func (c *LegacyClient) LegacyCheck(ctx context.Context, req LegacyCheckRequest) (bool, error) {
	call, err := c.PrepareLegacyCheck(req)
	if err != nil {
		return false, err
	}

	return call(ctx)
}

// PrepareLegacyCheck snapshots the request before background execution can outlive its caller.
// The returned call uses the supplied execution context and does not retain the requester or evaluator.
func (c *LegacyClient) PrepareLegacyCheck(req LegacyCheckRequest) (func(context.Context) (bool, error), error) {
	if c.clientV1 == nil {
		return nil, errors.New("legacy check client is not configured")
	}

	expression, err := accesscontrol.ToLegacyExpression(req.Evaluator)
	if err != nil {
		return nil, fmt.Errorf("converting evaluator to legacy expression: %w", err)
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

	var requesterOrgID *int64
	if req.RequesterOrgID != nil {
		orgID := *req.RequesterOrgID
		requesterOrgID = &orgID
	}
	var teamIDs *authzextv1.LegacyTeamIDs
	if req.TeamIDs != nil {
		teamIDs = &authzextv1.LegacyTeamIDs{Ids: slices.Clone(req.TeamIDs)}
	}

	request := &authzextv1.LegacyCheckRequest{
		Namespace:           req.Namespace,
		RequesterOrgId:      requesterOrgID,
		Subject:             req.Subject,
		Expression:          expression,
		TeamIds:             teamIDs,
		SkipCache:           req.SkipCache,
		SkipScopeResolution: req.SkipScopeResolution,
		InternalIdentity:    internal,
		Restriction:         restriction,
	}

	return func(ctx context.Context) (bool, error) {
		return c.legacyCheck(ctx, request)
	}, nil
}

func (c *LegacyClient) legacyCheck(ctx context.Context, req *authzextv1.LegacyCheckRequest) (allowed bool, err error) {
	ctx, span := c.tracer.Start(ctx, "LegacyClient.LegacyCheck")
	defer func() {
		if err != nil {
			_ = tracing.Error(span, err)
		}

		span.SetAttributes(attribute.Bool("allowed", allowed))
		span.End()
	}()

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
