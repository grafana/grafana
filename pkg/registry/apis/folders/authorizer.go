package folders

import (
	"context"
	"errors"
	"slices"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// newLegacyAuthorizer creates an authorizer using legacy access control, this is only usable for single tenant api.
func newLegacyAuthorizer(ac accesscontrol.AccessControl) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		in, err := authorizerFunc(ctx, attr)
		if err != nil {
			if errors.Is(err, errNoUser) {
				return authorizer.DecisionDeny, "", nil
			}
			return authorizer.DecisionNoOpinion, "", nil
		}

		ok, err := ac.Evaluate(ctx, in.user, in.evaluator)
		if ok {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "folder", err
	})
}

func authorizerFunc(ctx context.Context, attr authorizer.Attributes) (*authorizerParams, error) {
	allowedVerbs := []string{utils.VerbCreate, utils.VerbDelete, utils.VerbList}
	verb := attr.GetVerb()
	name := attr.GetName()
	if (!attr.IsResourceRequest()) || (name == "" && verb != utils.VerbCreate && slices.Contains(allowedVerbs, verb)) {
		return nil, errNoResource
	}

	// require a user
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, errNoUser
	}

	scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(name)
	var eval accesscontrol.Evaluator

	// "get" is used for sub-resources with GET http (parents, access, count)
	switch verb {
	case utils.VerbCreate:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersCreate)
	case utils.VerbPatch:
		fallthrough
	case utils.VerbUpdate:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, scope)
	case utils.VerbDeleteCollection:
		fallthrough
	case utils.VerbDelete:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, scope)
	case utils.VerbList:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersRead)
	default:
		eval = accesscontrol.EvalPermission(dashboards.ActionFoldersRead, scope)
	}
	return &authorizerParams{evaluator: eval, user: user}, nil
}

// newMultiTenantAuthorizer creates an authorizer sutiable to multi-tenant setup.
// For now it only allow authorization of access tokens.
func newMultiTenantAuthorizer(ac types.AccessClient) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
		info, ok := types.AuthInfoFrom(ctx)
		if !ok {
			return authorizer.DecisionDeny, "missing auth info", nil
		}

		// For now we only allow access policy to authorize with multi-tenant setup
		if !types.IsIdentityType(info.GetIdentityType(), types.TypeAccessPolicy) {
			return authorizer.DecisionDeny, "permission denied", nil
		}

		res, err := ac.Check(ctx, info, types.CheckRequest{
			Verb:        a.GetVerb(),
			Group:       a.GetAPIGroup(),
			Resource:    a.GetResource(),
			Name:        a.GetName(),
			Namespace:   a.GetNamespace(),
			Subresource: a.GetSubresource(),
		})

		if err != nil {
			return authorizer.DecisionDeny, "faild to perform authorization", err
		}

		if !res.Allowed {
			return authorizer.DecisionDeny, "permission denied", nil
		}

		return authorizer.DecisionAllow, "", nil
	})
}
