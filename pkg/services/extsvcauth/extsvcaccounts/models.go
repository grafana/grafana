package extsvcaccounts

import (
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	ExtSvcPrefix = "extsvc-"
	kvStoreType  = "extsvc-token"
	// #nosec G101 - this is not a hardcoded secret
	tokenNamePrefix = "extsvc-token"
)

var (
	ErrCannotBeDeleted   = errutil.BadRequest("extsvcaccounts.ErrCannotBeDeleted", errutil.WithPublicMessage("external service account cannot be deleted"))
	ErrInvalidName       = errutil.BadRequest("extsvcaccounts.ErrInvalidName", errutil.WithPublicMessage("only external service account names can be prefixed with 'extsvc-'"))
	ErrCannotBeUpdated   = errutil.BadRequest("extsvcaccounts.ErrCannotBeUpdated", errutil.WithPublicMessage("external service account cannot be updated"))
	ErrCannotCreateToken = errutil.BadRequest("extsvcaccounts.ErrCannotCreateToken", errutil.WithPublicMessage("cannot add external service account token"))
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
