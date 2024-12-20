package plugincheck

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func Authorize(ctx context.Context, ac accesscontrol.AccessControl, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	isAdmin := user.GetIsGrafanaAdmin()
	if isAdmin {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, "", err
}
