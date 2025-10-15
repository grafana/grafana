package authorizer

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	claims "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var _ authorizer.Authorizer = &coreRoleAuthorizer{}

type coreRoleAuthorizer struct {
	c claims.AccessClient
}

func NewCoreRoleAuthorizer(c claims.AccessClient) *coreRoleAuthorizer {
	return &coreRoleAuthorizer{c}
}

func (r coreRoleAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if attr.GetResource() != iamv0.CoreRoleInfo.GetName() {
		return authorizer.DecisionDeny, "", fmt.Errorf("unauthorized request: resource %s is not allowed by core role authorizer", attr.GetResource())
	}

	ident, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return authorizer.DecisionDeny, "", fmt.Errorf("unauthorized request: no identity found for request")
	}

	verb := attr.GetVerb()
	isReadVerb := verb == utils.VerbGet || verb == utils.VerbList || verb == utils.VerbWatch
	identityType := ident.GetIdentityType()
	isAccessPolicy := identityType == claims.TypeAccessPolicy

	if !isAccessPolicy && !isReadVerb {
		return authorizer.DecisionDeny, fmt.Sprintf(
			"unauthorized request: identity type %s is not allowed for verb %s",
			identityType, verb,
		), nil
	}

	res, err := r.c.Check(ctx, ident, claims.CheckRequest{
		Verb:        verb,
		Group:       attr.GetAPIGroup(),
		Resource:    attr.GetResource(),
		Namespace:   attr.GetNamespace(),
		Name:        attr.GetName(),
		Subresource: attr.GetSubresource(),
		Path:        attr.GetPath(),
	}, "")

	if err != nil {
		return authorizer.DecisionDeny, "", err
	}

	if !res.Allowed {
		return authorizer.DecisionDeny, "unauthorized request", nil
	}

	return authorizer.DecisionAllow, "", nil
}
