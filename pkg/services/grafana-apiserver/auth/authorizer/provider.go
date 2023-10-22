package authorizer

import (
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/authorizerfactory"
	"k8s.io/apiserver/pkg/authorization/union"

	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer/accesscontrol"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer/org"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer/stack"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideAuthorizer(
	cfg *setting.Cfg,
	orgIDAuthorizer *org.OrgIDAuthorizer,
	orgRoleAuthorizer *org.OrgRoleAuthorizer,
	stackIDAuthorizer *stack.StackIDAuthorizer,
	acAuthorizer *accesscontrol.AccessControlAuthorizer,
) authorizer.Authorizer {
	authorizers := []authorizer.Authorizer{
		authorizerfactory.NewPrivilegedGroups(user.SystemPrivilegedGroup),
	}

	// In Hosted grafana, the StackID replaces the orgID as a valid namespace
	if cfg.StackID != "" {
		authorizers = append(authorizers, stackIDAuthorizer)
	} else {
		authorizers = append(authorizers, orgIDAuthorizer)
	}

	// Add the ac authorizer last since it is the most expensive check
	authorizers = append(authorizers, acAuthorizer)

	return union.New(authorizers...)
}
