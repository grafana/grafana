package impersonation

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var _ authorizer.Authorizer = (*ImpersonationAuthorizer)(nil)

// ImpersonationAuthorizer denies all impersonation requests.
type ImpersonationAuthorizer struct{}

func (auth ImpersonationAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if a.GetVerb() == "impersonate" {
		return authorizer.DecisionDeny, "user impersonation is not supported", nil
	}
	return authorizer.DecisionNoOpinion, "", nil
}
