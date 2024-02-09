package passwordimpl

import (
	"unicode"

	"github.com/grafana/grafana/pkg/services/password"
	"github.com/grafana/grafana/pkg/setting"
)

type service struct {
	passwordPolicy string
}

func ProvideService(cfg *setting.Cfg) password.Service {
	return &service{}
}

func (s *service) ValidatePassword(newPassword []rune) error {
	if len(newPassword) < password.MinPasswordLength {
		return password.ErrPasswordTooShort
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
	return password.ErrPasswordPolicyInfringe
}
