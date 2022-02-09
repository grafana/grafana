package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type RoleCheckAuthorizer struct {
	role models.RoleType
}

func NewRoleCheckAuthorizer(role models.RoleType) *RoleCheckAuthorizer {
	return &RoleCheckAuthorizer{role: role}
}

func (s *RoleCheckAuthorizer) CanSubscribe(_ context.Context, u *models.SignedInUser) (bool, error) {
	return u.HasRole(s.role), nil
}

func (s *RoleCheckAuthorizer) CanPublish(_ context.Context, u *models.SignedInUser) (bool, error) {
	return u.HasRole(s.role), nil
}
