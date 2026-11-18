package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type RoleCheckAuthorizer struct {
	role identity.RoleType
}

func NewRoleCheckAuthorizer(role identity.RoleType) *RoleCheckAuthorizer {
	return &RoleCheckAuthorizer{role: role}
}

func (s *RoleCheckAuthorizer) CanSubscribe(_ context.Context, u identity.Requester) (bool, error) {
	return u.HasRole(s.role), nil
}

func (s *RoleCheckAuthorizer) CanPublish(_ context.Context, u identity.Requester) (bool, error) {
	return u.HasRole(s.role), nil
}
