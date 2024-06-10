package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/org"
)

type RoleCheckAuthorizer struct {
	role org.RoleType
}

func NewRoleCheckAuthorizer(role org.RoleType) *RoleCheckAuthorizer {
	return &RoleCheckAuthorizer{role: role}
}

func (s *RoleCheckAuthorizer) CanSubscribe(_ context.Context, u identity.Requester) (bool, error) {
	return u.HasRole(s.role), nil
}

func (s *RoleCheckAuthorizer) CanPublish(_ context.Context, u identity.Requester) (bool, error) {
	return u.HasRole(s.role), nil
}
