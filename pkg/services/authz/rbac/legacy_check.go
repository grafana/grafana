package rbac

import (
	"context"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// LegacyCheck is a deprecated compatibility RPC used by ST callers during the
// migration from local AccessControl evaluation to centralized AuthZ checks.
// Evaluation failures are returned as deny-with-error to avoid fail-open.
func (s *Service) LegacyCheck(ctx context.Context, req *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error) {
	// TODO: Complete in subsequent PRs:
	//   - ANY/ALL evaluators: nesting, empty expressions and short-circuit evaluation.
	//   - EvalPermission: action-only checks, explicit empty scopes and multiple scopes.
	//   - Scope resolution: inheritance, MutateScopes after denial, errors and WithoutResolvers.
	//   - Resolver caching: tenant isolation, bypass and invalidation.
	//   - Permissions: NoOrgID globals, action-set expansion, SharedWithMe and empty-permission denial.
	//   - Expression validation: invalid nodes, conflicting fields and tree limits.
	ns, err := validateNamespace(ctx, req.GetNamespace())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}
	userUID, idType, err := s.validateSubject(ctx, req.GetSubject())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}
	ctx = request.WithNamespace(ctx, ns.Value)

	permissions, _, err := s.getAllIdentityPermissions(ctx, ns, idType, userUID, req.GetTeams(), req.GetSkipCache())
	if err != nil {
		return &authzextv1.LegacyCheckResponse{Allowed: false, Error: err.Error()}, nil
	}

	evaluator := accesscontrol.EvalPermission(req.GetAction(), req.GetScope())
	allowed := evaluator.Evaluate(accesscontrol.GroupScopesByActionContext(ctx, permissions))
	return &authzextv1.LegacyCheckResponse{Allowed: allowed}, nil
}
