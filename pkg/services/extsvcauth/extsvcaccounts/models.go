package extsvcaccounts

import (
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	skvType = "extsvc-token"
)

// ExtSvcCredentials represents the credentials associated to an external service
type ExtSvcCredentials struct {
	Secret string
}

type SaveExtSvcCredentialsCmd struct {
	ExtSvcSlug string
	OrgID      int64
	Secret     string
}

type saveExtSvcAccountCmd struct {
	ExtSvcSlug  string
	OrgID       int64
	Permissions []ac.Permission
	SaID        int64
}

func newRole(r roletype.RoleType) *roletype.RoleType {
	return &r
}

func newBool(b bool) *bool {
	return &b
}
