package authorizer

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/union"

	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer/org"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer/stack"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideAuthorizer(
	orgIDAuthorizer *org.OrgIDAuthorizer,
	orgRoleAuthorizer *org.OrgRoleAuthorizer,
	stackIDAuthorizer *stack.StackIDAuthorizer,
	cfg *setting.Cfg,
) authorizer.Authorizer {
	authorizers := []authorizer.Authorizer{}

	// In Hosted grafana, the StackID replaces the orgID as a valid namespace
	if cfg.StackID != "" {
		authorizers = append(authorizers, stackIDAuthorizer)
	} else {
		authorizers = append(authorizers, orgIDAuthorizer)
	}

	// org role is last -- and will return allow for verbs that match expectations
	// Ideally FGAC happens earlier and returns an explicit answer
	authorizers = append(authorizers, orgRoleAuthorizer)
	return union.New(authorizers...)
}
