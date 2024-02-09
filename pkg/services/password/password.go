package password

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrPasswordTooShort       = errutil.NewBase(errutil.StatusBadRequest, "password-policy-too-short", errutil.WithPublicMessage("New password is too short"))
	ErrPasswordPolicyInfringe = errutil.NewBase(errutil.StatusBadRequest, "password-policy-infringe", errutil.WithPublicMessage("New password doesn't comply with the password policy"))
	MinPasswordLength         = 12
)

/*
Service interface for the password service
*/
type Service interface {
	ValidatePassword(newPassword []rune) error
}
