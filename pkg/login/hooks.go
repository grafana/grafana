package login

import LDAP "github.com/grafana/grafana/pkg/services/ldap"

var (
	hookLDAPReadConfig func() (bool, *LDAP.Config)
)
