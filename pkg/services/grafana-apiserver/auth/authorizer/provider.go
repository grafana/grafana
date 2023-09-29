package authorizer

import (
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/authorizerfactory"
	"k8s.io/apiserver/pkg/authorization/union"

	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer/org"
)

func ProvideAuthorizer(
	orgIDAuthorizer *org.OrgIDAuthorizer,
	orgRoleAuthorizer *org.OrgRoleAuthorizer,
) authorizer.Authorizer {
	authorizers := []authorizer.Authorizer{
		authorizerfactory.NewPrivilegedGroups(user.SystemPrivilegedGroup),
		orgIDAuthorizer,
		orgRoleAuthorizer,
	}
	return union.New(authorizers...)
}
