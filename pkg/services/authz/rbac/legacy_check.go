package rbac

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/folder"
)

// LegacyCheck is a deprecated compatibility RPC used by ST callers during the
// migration from local AccessControl evaluation to centralized AuthZ checks.
// Evaluation failures are returned as deny-with-error to avoid fail-open.
func (s *Service) LegacyCheck(ctx context.Context, req *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error) {
	return s.withLegacyCheckInstrumentation(ctx, req, func(ctx context.Context, req *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error) {
		if req.GetInternalIdentity() != nil {
			return &authzextv1.LegacyCheckResponse{
				Allowed: false,
				Error:   "internal legacy identities require the embedded server",
			}, nil
		}

		return s.legacyCheck(ctx, req)
	})
}

func (s *Service) withLegacyCheckInstrumentation(
	ctx context.Context,
	req *authzextv1.LegacyCheckRequest,
	check func(context.Context, *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error),
) (response *authzextv1.LegacyCheckResponse, err error) {
	start := time.Now()
	evaluation := "organization"
	if req.GetInternalIdentity() != nil {
		evaluation = "internal"
	} else if req != nil && req.RequesterOrgId != nil && (req.GetRequesterOrgId() == accesscontrol.GlobalOrgID || req.GetRequesterOrgId() == accesscontrol.NoOrgID) {
		evaluation = "global"
	}

	ctx, span := s.tracer.Start(ctx, "authz_direct_db.service.LegacyCheck", trace.WithAttributes(
		attribute.String("evaluation", evaluation),
		attribute.Bool("restricted", req.GetRestriction() != nil),
		attribute.Bool("skip_cache", req.GetSkipCache()),
		attribute.Bool("skip_scope_resolution", req.GetSkipScopeResolution()),
	))

	defer func() {
		checkErr := err
		errorType := "rpc"
		// Application failures use a successful gRPC status, so inspect the response too.
		if checkErr == nil && (response.GetError() != "" || response.GetErrorCode() != authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_UNSPECIFIED) {
			checkErr = fmt.Errorf("legacy check failed (%s): %s", response.GetErrorCode(), response.GetError())
			errorType = "application"
		}
		if checkErr != nil {
			s.metrics.legacyCheckErrors.WithLabelValues(evaluation, errorType).Inc()
			_ = tracing.Error(span, checkErr)
		}

		allowed := checkErr == nil && response.GetAllowed()

		s.metrics.legacyCheckRequests.WithLabelValues(evaluation, strconv.FormatBool(allowed)).Inc()
		s.metrics.legacyCheckDuration.WithLabelValues(evaluation, strconv.FormatBool(allowed)).Observe(time.Since(start).Seconds())
		span.SetAttributes(attribute.Bool("allowed", allowed))

		span.End()
	}()

	return check(ctx, req)
}

func (s *Service) legacyCheck(ctx context.Context, req *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error) {
	span := trace.SpanFromContext(ctx)

	// TODO: Complete in subsequent PRs:
	//   - Standalone scope resolution: replace embedded service dependencies with namespace-aware providers.
	//			MT AuthZ: https://github.com/grafana/identity-access-team/issues/2436
	ns, err := validateNamespace(ctx, req.GetNamespace())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	if err := s.validateLegacyScopeNamespace(ns); err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	requesterOrgID, err := legacyRequesterOrgID(req, ns)
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	var (
		userUID string
		idType  types.IdentityType

		isInternalIdentity = req.GetInternalIdentity() != nil
	)
	if !isInternalIdentity {
		userUID, idType, err = s.validateSubject(ctx, req.GetSubject())
		if err != nil {
			return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
		}
	}

	ctx = request.WithNamespace(ctx, ns.Value)
	evaluator, actions, err := convertLegacyExpression(req.GetExpression())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}
	span.SetAttributes(attribute.Int("action_count", len(actions)))

	scopeRequest := legacyScopeRequest{
		namespace:    ns,
		identityType: idType,
		userUID:      userUID,
		skipCache:    req.GetSkipCache(),
	}

	if restriction := req.GetRestriction(); restriction != nil {
		// Preserve presence even when protobuf decodes an empty list as nil.
		scopeRequest.restrictedActions = append([]string{}, restriction.GetActions()...)
	}

	var args legacyEvaluationArgs
	if isInternalIdentity {
		args, err = s.prepareLegacyInternalEvaluation(ctx, req, scopeRequest)
	} else if requesterOrgID == accesscontrol.GlobalOrgID || requesterOrgID == accesscontrol.NoOrgID {
		args, err = s.prepareLegacyGlobalEvaluation(ctx, requesterOrgID, actions, scopeRequest)
	} else {
		args, err = s.prepareLegacyPermissions(ctx, actions, scopeRequest)
	}

	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	if !args.hasAnyPermissions {
		return &authzextv1.LegacyCheckResponse{Allowed: false}, nil
	}

	allowed, err := s.evaluateLegacyWithResolvers(
		ctx,
		evaluator,
		args.permissions,
		args.hasAnyPermissions,
		req.GetSkipScopeResolution(),
		args.scopeRequest,
	)
	if err != nil {
		code := authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_UNSPECIFIED
		if errors.Is(err, accesscontrol.ErrScopeResourceNotFound) {
			code = authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_SCOPE_RESOURCE_NOT_FOUND
		}
		return &authzextv1.LegacyCheckResponse{
			Allowed:   false,
			Error:     err.Error(),
			ErrorCode: code,
		}, nil
	}

	return &authzextv1.LegacyCheckResponse{Allowed: allowed}, nil
}

func legacyRequesterOrgID(req *authzextv1.LegacyCheckRequest, namespace types.NamespaceInfo) (int64, error) {
	if namespace.OrgID < 1 {
		return 0, errors.New("legacy check requires a concrete namespace")
	}
	if req.RequesterOrgId == nil {
		if req.GetInternalIdentity() != nil {
			return namespace.OrgID, nil
		}
		return 0, errors.New("legacy check requires requester org ID")
	}

	orgID := *req.RequesterOrgId
	if orgID < accesscontrol.NoOrgID {
		return 0, errors.New("requester org must be positive, 0 or NoOrgID")
	}
	if orgID > 0 && orgID != namespace.OrgID {
		return 0, errors.New("requester org does not match namespace")
	}
	if req.GetInternalIdentity() != nil && orgID < 1 {
		return 0, errors.New("internal legacy identity requires an organization requester")
	}

	return orgID, nil
}

// getLegacyIdentityPermissions loads only the requested actions, including
// implicit grants that are not stored in the permission store.
func (s *Service) getLegacyIdentityPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	idType types.IdentityType,
	userUID string,
	actions []string,
	skipCache bool,
) (map[string][]string, error) {
	permissions := make(map[string][]string, len(actions))
	query := store.PermissionsQuery{}
	switch idType {
	case types.TypeUser, types.TypeServiceAccount:
		identifiers, err := s.getUserIdentifiers(ctx, ns, userUID, skipCache)
		if err != nil {
			return nil, fmt.Errorf("could not get user identifiers: %w", err)
		}

		query, err = s.getLegacyUserPermissionQuery(ctx, ns, identifiers, skipCache)
		if err != nil {
			return nil, fmt.Errorf("could not get legacy user permission query: %w", err)
		}
	case types.TypeAnonymous:
		query.Role = s.settings.AnonOrgRole
	case types.TypeRenderService:
		for _, action := range actions {
			scopes, err := s.getRendererPermissions(ctx, action)
			if err != nil {
				return nil, fmt.Errorf("could not get renderer permissions: %w", err)
			}
			if scopes["*"] {
				permissions[action] = []string{"*"}
			}
		}
		return permissions, nil
	default:
		return nil, fmt.Errorf("unsupported identity type: %s", idType)
	}

	for _, action := range actions {
		actionQuery := query
		actionQuery.Action = action
		if s.actionResolver != nil {
			actionQuery.ActionSets = s.actionResolver.ResolveAction(action)
		}

		grants, err := s.permissionStore.GetUserPermissions(ctx, ns, actionQuery)
		if err != nil {
			return nil, fmt.Errorf("could not get user permissions: %w", err)
		}
		// Modern Kubernetes checks normalize scopes. Legacy evaluators need
		// the original strings, including empty scopes on action-only grants.
		for _, grant := range grants {
			permissions[action] = append(permissions[action], grant.Scope)
		}

		if action == folder.ActionFoldersRead {
			sharedWithMeScope := folder.ScopeFoldersProvider.GetResourceScopeUID(folder.SharedWithMeFolderUID)
			permissions[action] = append(permissions[action], sharedWithMeScope)
		}
	}

	return permissions, nil
}

func (s *Service) getLegacyUserPermissionQuery(
	ctx context.Context,
	ns types.NamespaceInfo,
	userIdentifiers *store.UserIdentifiers,
	skipCache bool,
) (store.PermissionsQuery, error) {
	basicRole, err := s.getUserBasicRoleWithCache(ctx, ns, userIdentifiers, skipCache)
	if err != nil {
		return store.PermissionsQuery{}, fmt.Errorf("could not get user basic role: %w", err)
	}

	teamIDs, err := s.getUserTeamsWithCache(ctx, ns, userIdentifiers, skipCache)
	if err != nil {
		return store.PermissionsQuery{}, fmt.Errorf("could not get user teams: %w", err)
	}

	return store.PermissionsQuery{
		UserID:        userIdentifiers.ID,
		TeamIDs:       teamIDs,
		Role:          basicRole.Role,
		IsServerAdmin: basicRole.IsAdmin,
	}, nil
}

type legacyEvaluationArgs struct {
	permissions       map[string][]string
	hasAnyPermissions bool
	scopeRequest      legacyScopeRequest
}
