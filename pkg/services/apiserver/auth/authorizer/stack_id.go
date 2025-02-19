package authorizer

import (
	"context"
	"fmt"
	"strconv"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authorizer.Authorizer = &stackIDAuthorizer{}

type stackIDAuthorizer struct {
	log     log.Logger
	stackID int64
}

func newStackIDAuthorizer(cfg *setting.Cfg) *stackIDAuthorizer {
	stackID, err := strconv.ParseInt(cfg.StackID, 10, 64)
	if err != nil {
		return nil
	}
	return &stackIDAuthorizer{
		log:     log.New("grafana-apiserver.authorizer.stackid"),
		stackID: stackID, // this lets a single tenant grafana validate stack id (rather than orgs)
	}
}

func (auth stackIDAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error getting signed in user: %v", err), nil
	}

	// If we have an anonymous user, let the next authorizers decide.
	if signedInUser.GetIdentityType() == claims.TypeAnonymous {
		return authorizer.DecisionNoOpinion, "", nil
	}

	info, err := claims.ParseNamespace(a.GetNamespace())
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error reading namespace: %v", err), nil
	}

	// No opinion when the namespace is empty
	if info.Value == "" {
		return authorizer.DecisionNoOpinion, "", nil
	}
	if info.StackID != auth.stackID {
		msg := fmt.Sprintf("wrong stack id is selected (expected: %d, found %d)", auth.stackID, info.StackID)
		return authorizer.DecisionDeny, msg, nil
	}
	if info.OrgID != 1 {
		return authorizer.DecisionDeny, "cloud instance requires org 1", nil
	}
	if signedInUser.GetOrgID() != 1 {
		return authorizer.DecisionDeny, "user must be in org 1", nil
	}

	return authorizer.DecisionNoOpinion, "", nil
}
