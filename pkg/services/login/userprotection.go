package login

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type UserProtectionService interface {
	AllowUserMapping(user *user.User, authModule string) error
	ShouldProtect(ctx context.Context, user *user.User) (bool, error)
}
