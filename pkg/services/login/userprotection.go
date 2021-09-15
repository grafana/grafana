package login

import "github.com/grafana/grafana/pkg/models"

type UserProtectionService interface {
	AllowUserMapping(user *models.User, authModule string) error
}
