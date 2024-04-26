package authorizer

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
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
	signedInUser, err := appcontext.User(ctx)
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error getting signed in user: %v", err), nil
	}

	info, err := grafanarequest.ParseNamespace(a.GetNamespace())
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error reading namespace: %v", err), nil
	}

	// No opinion when the namespace is arbitrary
	if info.OrgID == -1 {
		return authorizer.DecisionNoOpinion, "", nil
	}

	if info.StackID != "" {
		return authorizer.DecisionDeny, "using a stack namespace requires deployment with a fixed stack id", nil
	}

	// Quick check that the same org is used
	if signedInUser.OrgID == info.OrgID {
		return authorizer.DecisionNoOpinion, "", nil
	}

	// Check if the user has access to the specified org
	query := org.GetUserOrgListQuery{UserID: signedInUser.UserID}
	result, err := auth.org.GetUserOrgList(ctx, &query)
	if err != nil {
		return authorizer.DecisionDeny, "error getting user org list", err
	}

	for _, org := range result {
		if org.OrgID == info.OrgID {
			return authorizer.DecisionNoOpinion, "", nil
		}
	}

	return authorizer.DecisionDeny, fmt.Sprintf("user %d is not a member of org %d", signedInUser.UserID, info.OrgID), nil
}
