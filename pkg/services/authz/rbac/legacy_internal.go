package rbac

import (
	"context"
	"errors"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/org"
)

type embeddedLegacyCheckServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	service *Service
}

// RegisterEmbeddedLegacyCheckServer permits internal identity assertions only on
// an in-process channel. Ordinary Service registration rejects these assertions.
func RegisterEmbeddedLegacyCheckServer(channel *inprocgrpc.Channel, service *Service) {
	authzv1.RegisterLegacyAuthzServiceServer(channel, &embeddedLegacyCheckServer{service: service})
}

func (s *embeddedLegacyCheckServer) LegacyCheck(ctx context.Context, req *authzv1.LegacyCheckRequest) (*authzv1.LegacyCheckResponse, error) {
	return s.service.withLegacyCheckInstrumentation(ctx, req, s.service.legacyCheck)
}

func (s *Service) prepareLegacyInternalEvaluation(
	ctx context.Context,
	req *authzv1.LegacyCheckRequest,
	scopeRequest legacyScopeRequest,
) (legacyEvaluationArgs, error) {
	if err := s.validateLegacyInternalEvaluation(req, scopeRequest.namespace); err != nil {
		return legacyEvaluationArgs{}, err
	}

	if background := req.GetInternalIdentity().GetBackground(); background != nil {
		requester := accesscontrol.BackgroundUser(
			background.GetName(),
			scopeRequest.namespace.OrgID,
			org.RoleType(background.GetOrgRole()),
			legacyBackgroundPermissions(background.GetPermissions()),
		)
		permissions := requester.GetPermissions()

		scopeRequest.internalRequester = requester
		return legacyEvaluationArgs{
			permissions:       permissions,
			hasAnyPermissions: len(permissions) > 0,
			scopeRequest:      scopeRequest,
		}, nil
	}

	profile := identity.InternalIdentityProfile(req.GetInternalIdentity().GetProfile())
	permissions, ok := identity.InternalIdentityPermissions(profile)
	if !ok {
		return legacyEvaluationArgs{}, errors.New("unsupported internal legacy identity profile")
	}

	requester, err := newLegacyInternalRequester(ctx, profile, scopeRequest.namespace)
	if err != nil {
		return legacyEvaluationArgs{}, err
	}

	scopeRequest.internalRequester = requester

	return legacyEvaluationArgs{
		permissions:       permissions,
		hasAnyPermissions: len(permissions) > 0,
		scopeRequest:      scopeRequest,
	}, nil
}

func legacyBackgroundPermissions(grants map[string]*authzv1.LegacyPermissionScopes) []accesscontrol.Permission {
	permissions := make([]accesscontrol.Permission, 0, len(grants))
	for action, grant := range grants {
		scopes := grant.GetScopes()
		if len(scopes) == 0 {
			// An action key without scopes still grants action-only checks.
			permissions = append(permissions, accesscontrol.Permission{Action: action})
			continue
		}

		for _, scope := range scopes {
			permissions = append(permissions, accesscontrol.Permission{Action: action, Scope: scope})
		}
	}

	return permissions
}

func (s *Service) validateLegacyInternalEvaluation(
	req *authzv1.LegacyCheckRequest,
	namespace types.NamespaceInfo,
) error {
	if req.GetInternalIdentity().GetBackground() != nil && req.GetInternalIdentity().GetProfile() != "" {
		return errors.New("background legacy identity cannot be combined with a predefined profile")
	}

	if req.GetRestriction() != nil {
		return errors.New("internal legacy identity cannot be combined with an action restriction")
	}

	if req.GetSubject() != "" {
		return errors.New("internal legacy identity cannot be combined with a subject")
	}

	if namespace.OrgID < 1 || s.legacyScopeNamespace == nil || s.legacyScopeNamespace(namespace.OrgID) != namespace.Value {
		return errors.New("internal legacy identity requires a concrete namespace belonging to this instance")
	}

	return nil
}

func newLegacyInternalRequester(
	ctx context.Context,
	profile identity.InternalIdentityProfile,
	namespace types.NamespaceInfo,
) (identity.Requester, error) {
	switch profile {
	case identity.InternalIdentityService:
		_, requester := identity.WithServiceIdentity(ctx, namespace.OrgID, func(r *identity.StaticRequester) {
			r.Namespace = namespace.Value
		})

		return requester, nil
	case identity.InternalIdentityProvisioning:
		_, requester, err := identity.WithProvisioningIdentity(ctx, namespace.Value)
		if err != nil {
			return nil, err
		}

		return requester, nil
	default:
		return nil, errors.New("unsupported internal legacy identity profile")
	}
}
