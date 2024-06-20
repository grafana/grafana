package authorizer

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authorizer.Authorizer = &stackIDAuthorizer{}

type stackIDAuthorizer struct {
	log     log.Logger
	stackID string
}

func newStackIDAuthorizer(cfg *setting.Cfg) *stackIDAuthorizer {
	return &stackIDAuthorizer{
		log:     log.New("grafana-apiserver.authorizer.stackid"),
		stackID: cfg.StackID, // this lets a single tenant grafana validate stack id (rather than orgs)
	}
}

func (auth stackIDAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
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

	if info.StackID != auth.stackID {
		return authorizer.DecisionDeny, "wrong stack id is selected", nil
	}
	if info.OrgID != 1 {
		return authorizer.DecisionDeny, "cloud instance requires org 1", nil
	}
	if signedInUser.GetOrgID() != 1 {
		return authorizer.DecisionDeny, "user must be in org 1", nil
	}

	return authorizer.DecisionNoOpinion, "", nil
}
