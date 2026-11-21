package pipeline

import (
	"context"
	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type RoleCheckAuthorizer struct {
	role authlib.RoleType
}

func NewRoleCheckAuthorizer(role authlib.RoleType) *RoleCheckAuthorizer {
	return &RoleCheckAuthorizer{role: role}
}

func (s *RoleCheckAuthorizer) CanSubscribe(_ context.Context, u identity.Requester) (bool, error) {
	return u.HasRole(s.role), nil
}

func (s *RoleCheckAuthorizer) CanPublish(_ context.Context, u identity.Requester) (bool, error) {
	return u.HasRole(s.role), nil
}
