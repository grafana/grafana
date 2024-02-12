package user

import (
	"unicode"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrPasswordTooShort       = errutil.NewBase(errutil.StatusBadRequest, "password-policy-too-short", errutil.WithPublicMessage("New password is too short"))
	ErrPasswordPolicyInfringe = errutil.NewBase(errutil.StatusBadRequest, "password-policy-infringe", errutil.WithPublicMessage("New password doesn't comply with the password policy"))
	MinPasswordLength         = 12
)

/*
Static function for password validation
*/
func ValidatePassword(newPassword Password, config *setting.Cfg) error {
	featureFlag := config.IsFeatureToggleEnabled(featuremgmt.FlagPasswordPolicy)
	passwordPolicyEnabled := config.BasicAuthStrongPasswordPolicy
	if !featureFlag || !passwordPolicyEnabled {
		if newPassword.IsWeak() {
			return ErrPasswordTooShort
		}
		return nil
	}
	if len(newPassword) < MinPasswordLength {
		return ErrPasswordTooShort
	}

	hasUpperCase := false
	hasLowerCase := false
	hasNumber := false
	hasSymbol := false

	for _, r := range newPassword {
		if !hasLowerCase && unicode.IsLower(r) {
			hasLowerCase = true
		}

		if !hasUpperCase && unicode.IsUpper(r) {
			hasUpperCase = true
		}

		if !hasNumber && unicode.IsNumber(r) {
			hasNumber = true
		}

		if !hasSymbol && !unicode.IsLetter(r) && !unicode.IsNumber(r) {
			hasSymbol = true
		}

		if hasUpperCase && hasLowerCase && hasNumber && hasSymbol {
			return nil
		}
	}
	return ErrPasswordPolicyInfringe
}
