package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

type RoleCheckAuthorizer struct {
	role org.RoleType
}

func NewRoleCheckAuthorizer(role org.RoleType) *RoleCheckAuthorizer {
	return &RoleCheckAuthorizer{role: role}
}

func (s *RoleCheckAuthorizer) CanSubscribe(_ context.Context, u *user.SignedInUser) (bool, error) {
	return u.HasRole(s.role), nil
}

func (s *RoleCheckAuthorizer) CanPublish(_ context.Context, u *user.SignedInUser) (bool, error) {
	return u.HasRole(s.role), nil
}
