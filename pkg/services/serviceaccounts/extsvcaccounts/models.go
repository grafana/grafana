package extsvcaccounts

import (
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	metricsNamespace = "grafana"

	kvStoreType = "extsvc-token"
	// #nosec G101 - this is not a hardcoded secret
	tokenNamePrefix = "extsvc-token"

	maxTokenGenRetries = 10
)

var (
	ErrCannotBeDeleted      = errutil.BadRequest("extsvcaccounts.ErrCannotBeDeleted", errutil.WithPublicMessage("external service account cannot be deleted"))
	ErrCannotBeUpdated      = errutil.BadRequest("extsvcaccounts.ErrCannotBeUpdated", errutil.WithPublicMessage("external service account cannot be updated"))
	ErrCannotCreateToken    = errutil.BadRequest("extsvcaccounts.ErrCannotCreateToken", errutil.WithPublicMessage("cannot add external service account token"))
	ErrCannotDeleteToken    = errutil.BadRequest("extsvcaccounts.ErrCannotDeleteToken", errutil.WithPublicMessage("cannot delete external service account token"))
	ErrCannotListTokens     = errutil.BadRequest("extsvcaccounts.ErrCannotListTokens", errutil.WithPublicMessage("cannot list external service account tokens"))
	ErrCredentialsGenFailed = errutil.Internal("extsvcaccounts.ErrCredentialsGenFailed")
	ErrCredentialsNotFound  = errutil.NotFound("extsvcaccounts.ErrCredentialsNotFound")
	ErrInvalidName          = errutil.BadRequest("extsvcaccounts.ErrInvalidName", errutil.WithPublicMessage("only external service account names can be prefixed with 'extsvc-'"))
)

func extsvcuser(orgID int64) *user.SignedInUser {
	return &user.SignedInUser{
		OrgID: orgID,
		Permissions: map[int64]map[string][]string{
			orgID: {serviceaccounts.ActionRead: {"serviceaccounts:id:*"}},
		},
	}
}

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
	Enabled     bool
	ExtSvcSlug  string
	OrgID       int64
	Permissions []ac.Permission
	SaID        int64
}

func newRole(r identity.RoleType) *identity.RoleType {
	return &r
}

func newBool(b bool) *bool {
	return &b
}
