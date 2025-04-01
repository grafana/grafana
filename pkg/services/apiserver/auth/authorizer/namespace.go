package authorizer

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

type namespaceAuthorizer struct {
}

func newNamespaceAuthorizer() *namespaceAuthorizer {
	return &namespaceAuthorizer{}
}

func (auth namespaceAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "missing auth info", fmt.Errorf("missing auth info: %w", err)
	}

	if ident.GetIsGrafanaAdmin() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	if !a.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	// If we have an anonymous user, let the next authorizers decide.
	if types.IsIdentityType(ident.GetIdentityType(), types.TypeAnonymous) {
		return authorizer.DecisionNoOpinion, "", nil
	}

	ns, err := types.ParseNamespace(a.GetNamespace())
	if err != nil {
		return authorizer.DecisionDeny, "invalid namespace", err
	}

	// If we call a cluster resource we delegate to the next authorizer
	if ns.Value == "" {
		return authorizer.DecisionNoOpinion, "", nil
	}

	if ns.OrgID != ident.GetOrgID() {
		return authorizer.DecisionDeny, "invalid org", nil
	}

	if !types.NamespaceMatches(ident.GetNamespace(), a.GetNamespace()) {
		return authorizer.DecisionDeny, "invalid namespace", nil
	}

	return authorizer.DecisionNoOpinion, "", nil
}
