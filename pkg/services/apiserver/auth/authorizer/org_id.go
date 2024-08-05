package authorizer

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var _ authorizer.Authorizer = &orgIDAuthorizer{}

type orgIDAuthorizer struct {
	log log.Logger
	org org.Service
}

func newOrgIDAuthorizer(orgService org.Service) *orgIDAuthorizer {
	return &orgIDAuthorizer{
		log: log.New("grafana-apiserver.authorizer.orgid"),
		org: orgService,
	}
}

func (auth orgIDAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error getting signed in user: %v", err), nil
	}

	info, err := grafanarequest.ParseNamespace(a.GetNamespace())
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error reading namespace: %v", err), nil
	}

	// No opinion when the namespace is empty
	if info.Value == "" {
		return authorizer.DecisionNoOpinion, "", nil
	}

	if info.OrgID == -1 {
		return authorizer.DecisionDeny, "org id is required", nil
	}

	if info.StackID != "" {
		return authorizer.DecisionDeny, "using a stack namespace requires deployment with a fixed stack id", nil
	}

	// Quick check that the same org is used
	if signedInUser.GetOrgID() == info.OrgID {
		return authorizer.DecisionNoOpinion, "", nil
	}

	// Check if the user has access to the specified org
	// nolint:staticcheck
	userId, err := signedInUser.GetInternalID()
	if err != nil {
		return authorizer.DecisionDeny, "unable to get userId", err
	}
	query := org.GetUserOrgListQuery{UserID: userId}
	result, err := auth.org.GetUserOrgList(ctx, &query)
	if err != nil {
		return authorizer.DecisionDeny, "error getting user org list", err
	}

	for _, org := range result {
		if org.OrgID == info.OrgID {
			return authorizer.DecisionNoOpinion, "", nil
		}
	}

	return authorizer.DecisionDeny, fmt.Sprintf("user %d is not a member of org %d", userId, info.OrgID), nil
}
