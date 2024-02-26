package user

import (
	"unicode"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrPasswordTooShort       = errutil.NewBase(errutil.StatusBadRequest, "password-policy-too-short", errutil.WithPublicMessage("New password is too short"))
	ErrPasswordPolicyInfringe = errutil.NewBase(errutil.StatusBadRequest, "password-policy-infringe", errutil.WithPublicMessage("New password doesn't comply with the password policy"))
	MinPasswordLength         = 12
)

type Password string

func NewPassword(newPassword string, config *setting.Cfg) (Password, error) {
	if err := ValidatePassword(newPassword, config); err != nil {
		return "", err
	}
	return Password(newPassword), nil
}

func (p Password) Validate(config *setting.Cfg) error {
	return ValidatePassword(string(p), config)
}

// ValidatePassword checks if a new password meets the required criteria based on the given configuration.
// If BasicAuthStrongPasswordPolicy is disabled, it only checks for password length.
// Otherwise, it ensures the password meets the minimum length requirement and contains at least one uppercase letter,
// one lowercase letter, one number, and one symbol.
func ValidatePassword(newPassword string, config *setting.Cfg) error {
	if !config.BasicAuthStrongPasswordPolicy {
		if len(newPassword) <= 4 {
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
