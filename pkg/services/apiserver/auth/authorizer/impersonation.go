package authorizer

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var _ authorizer.Authorizer = (*impersonationAuthorizer)(nil)

func newImpersonationAuthorizer() *impersonationAuthorizer {
	return &impersonationAuthorizer{}
}

// ImpersonationAuthorizer denies all impersonation requests.
type impersonationAuthorizer struct{}

func (auth impersonationAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if a.GetVerb() == "impersonate" {
		return authorizer.DecisionDeny, "user impersonation is not supported", nil
	}
	return authorizer.DecisionNoOpinion, "", nil
}
