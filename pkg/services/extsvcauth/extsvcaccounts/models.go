package extsvcaccounts

import (
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	ExtsvcPrefix = "extsvc-"
	kvStoreType  = "extsvc-token"
	// #nosec G101 - this is not a hardcoded secret
	tokenNamePrefix = "extsvc-token"
)

var (
	ErrExtServiceAccountCannotBeDeleted = errutil.BadRequest("extsvcaccounts.ErrExtServiceAccountCannotBeDeleted", errutil.WithPublicMessage("external service account cannot be deleted"))
	ErrExtServiceAccountCannotBeCreated = errutil.BadRequest("extsvcaccounts.ErrExtServiceAccountCannotBeCreated", errutil.WithPublicMessage("external service account cannot be created"))
)

// Credentials represents the credentials associated to an external service
type Credentials struct {
	Secret string
}

type SaveCredentialsCmd struct {
	ExtSvcSlug string
	OrgID      int64
	Secret     string
}

type saveCmd struct {
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
