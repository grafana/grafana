package authorizer

import (
	"context"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var _ authorizer.Authorizer = &noAnonymousUsers{}

type noAnonymousUsers struct{}

func NewNotAnonymousAuthorizer() authorizer.Authorizer {
	return &noAnonymousUsers{}
}

func (auth noAnonymousUsers) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if isAnonymousUser(a.GetUser()) {
		return authorizer.DecisionDeny, "Anonymous access is not supported",
			errors.NewUnauthorized("") // 401 suggest login?
	}
	return authorizer.DecisionNoOpinion, "", nil
}

// https://github.com/kubernetes/kubernetes/blob/v1.30.2/staging/src/k8s.io/apiserver/pkg/endpoints/filters/authentication.go#L157
func isAnonymousUser(u user.Info) bool {
	if u.GetName() == user.Anonymous {
		return true
	}
	for _, group := range u.GetGroups() {
		if group == user.AllUnauthenticated {
			return true
		}
	}
	return false
}
