package org

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
)

var _ authorizer.Authorizer = &OrgIDAuthorizer{}

type OrgIDAuthorizer struct {
	log log.Logger
	org org.Service
}

func ProvideOrgIDAuthorizer(orgService org.Service) *OrgIDAuthorizer {
	return &OrgIDAuthorizer{log: log.New("grafana-apiserver.authorizer.orgid"), org: orgService}
}

func (auth OrgIDAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	signedInUser, err := appcontext.User(ctx)
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error getting signed in user: %v", err), nil
	}

	orgID, ok := grafanarequest.ParseOrgID(a.GetNamespace())
	if !ok {
		return authorizer.DecisionNoOpinion, "", nil
	}

	query := org.GetUserOrgListQuery{UserID: signedInUser.UserID}
	result, err := auth.org.GetUserOrgList(ctx, &query)
	if err != nil {
		return authorizer.DecisionDeny, "error getting user org list", err
	}

	for _, org := range result {
		if org.OrgID == orgID {
			return authorizer.DecisionAllow, "", nil
		}
	}

	return authorizer.DecisionDeny, fmt.Sprintf("user %d is not a member of org %d", signedInUser.UserID, orgID), nil
}
