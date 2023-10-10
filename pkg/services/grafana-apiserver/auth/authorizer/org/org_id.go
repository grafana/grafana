package org

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authorizer.Authorizer = &OrgIDAuthorizer{}

type OrgIDAuthorizer struct {
	log     log.Logger
	org     org.Service
	stackID string
}

func ProvideOrgIDAuthorizer(orgService org.Service, cfg *setting.Cfg) *OrgIDAuthorizer {
	return &OrgIDAuthorizer{
		log:     log.New("grafana-apiserver.authorizer.orgid"),
		org:     orgService,
		stackID: cfg.StackID, // this lets a single tenant grafana validate stack id (rather than orgs)
	}
}

func (auth OrgIDAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	signedInUser, err := appcontext.User(ctx)
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error getting signed in user: %v", err), nil
	}

	info, err := grafanarequest.ParseNamespace(a.GetNamespace())
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error reading namespace: %v", err), nil
	}

	if auth.stackID != "" {
		if info.StackID != auth.stackID {
			return authorizer.DecisionDeny, "wrong stack id is selected", nil
		}
		// TODO: does the signedInUser knows its stackID?
		return authorizer.DecisionDeny, "Cloud stack validation is not yet implemented", nil
	}

	// Quick check that the same org is used
	if signedInUser.OrgID == info.OrgID {
		return authorizer.DecisionAllow, "", nil
	}

	query := org.GetUserOrgListQuery{UserID: signedInUser.UserID}
	result, err := auth.org.GetUserOrgList(ctx, &query)
	if err != nil {
		return authorizer.DecisionDeny, "error getting user org list", err
	}

	for _, org := range result {
		if org.OrgID == info.OrgID {
			return authorizer.DecisionAllow, "", nil
		}
	}

	return authorizer.DecisionDeny, fmt.Sprintf("user %d is not a member of org %d", signedInUser.UserID, info.OrgID), nil
}
