package authorizer

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

var _ authorizer.Authorizer = &signedInUser{}

type signedInUser struct{}

func NewRequireSignedInAuthorizer() authorizer.Authorizer {
	return &signedInUser{}
}

func (auth signedInUser) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error getting signed in user: %v", err), nil
	}
	if requester.GetID().Namespace() == identity.NamespaceAnonymous {
		return authorizer.DecisionDeny, "Anonymous access is not supported", errors.NewUnauthorized("")
	}
	return authorizer.DecisionNoOpinion, "", nil
}
