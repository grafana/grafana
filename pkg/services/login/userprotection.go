package login

import (
	"github.com/grafana/grafana/pkg/services/user"
)

type UserProtectionService interface {
	AllowUserMapping(user *user.User, authModule string) error
}
