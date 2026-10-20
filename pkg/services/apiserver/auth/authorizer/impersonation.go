package authorizer

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var _ authorizer.Authorizer = (*impersonationAuthorizer)(nil)

func NewImpersonationAuthorizer() *impersonationAuthorizer {
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

// ConditionsAwareAuthorize implements authorizer.Authorizer.
func (auth impersonationAuthorizer) ConditionsAwareAuthorize(ctx context.Context, a authorizer.Attributes) authorizer.ConditionsAwareDecision {
	return authorizer.ConditionsAwareDecisionFromParts(auth.Authorize(ctx, a))
}

// EvaluateConditions implements authorizer.Authorizer.
func (auth impersonationAuthorizer) EvaluateConditions(_ context.Context, _ authorizer.ConditionsAwareDecision, _ authorizer.ConditionsData) (authorizer.Decision, string, error) {
	return authorizer.DecisionDeny, "", authorizer.ErrorConditionEvaluationNotSupported
}
