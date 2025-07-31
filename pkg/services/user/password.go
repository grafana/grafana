package user

import (
	"unicode"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrPasswordTooShort       = errutil.BadRequest("password.password-policy-too-short", errutil.WithPublicMessage("New password is too short"))
	ErrPasswordPolicyInfringe = errutil.BadRequest("password.password-policy-infringe", errutil.WithPublicMessage("New password doesn't comply with the password policy"))
	MinPasswordLength         = 12
)

type Password string

func NewPassword(newPassword string, settingsProvider setting.SettingsProvider) (Password, error) {
	if err := ValidatePassword(newPassword, settingsProvider); err != nil {
		return "", err
	}
	return Password(newPassword), nil
}

func (p Password) Validate(settingsProvider setting.SettingsProvider) error {
	return ValidatePassword(string(p), settingsProvider)
}

func (p Password) Hash(salt string) (Password, error) {
	hashed, err := util.EncodePassword(string(p), salt)
	if err != nil {
		return "", err
	}
	return Password(hashed), nil
}

// ValidatePassword checks if a new password meets the required criteria based on the given configuration.
// If BasicAuthStrongPasswordPolicy is disabled, it only checks for password length.
// Otherwise, it ensures the password meets the minimum length requirement and contains at least one uppercase letter,
// one lowercase letter, one number, and one symbol.
func ValidatePassword(newPassword string, settingsProvider setting.SettingsProvider) error {
	cfg := settingsProvider.Get()
	if !cfg.BasicAuthStrongPasswordPolicy {
		if len(newPassword) < 4 {
			return ErrPasswordTooShort.Errorf("new password is too short")
		}
		return nil
	}
	if len(newPassword) < MinPasswordLength {
		return ErrPasswordPolicyInfringe.Errorf("new password is too short for the strong password policy")
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
	return ErrPasswordPolicyInfringe.Errorf("new password doesn't comply with the password policy")
}
