package identity_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestRequesterFromContext(t *testing.T) {
	t.Run("User should error when context is missing user", func(t *testing.T) {
		usr, err := identity.GetRequester(context.Background())
		require.Nil(t, usr)
		require.Error(t, err)
	})

	t.Run("should return user set by ContextWithUser", func(t *testing.T) {
		expected := &dummyUser{UID: "AAA"}
		ctx := identity.WithRequester(context.Background(), expected)
		actual, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.Equal(t, expected.GetUID(), actual.GetUID())
	})
}

type dummyUser struct {
	UID string
}

// GetAuthID implements identity.Requester.
func (d *dummyUser) GetAuthID() string {
	panic("unimplemented")
}

// GetAuthenticatedBy implements identity.Requester.
func (d *dummyUser) GetAuthenticatedBy() string {
	panic("unimplemented")
}

// GetCacheKey implements identity.Requester.
func (d *dummyUser) GetCacheKey() string {
	panic("unimplemented")
}

// GetDisplayName implements identity.Requester.
func (d *dummyUser) GetDisplayName() string {
	panic("unimplemented")
}

// GetEmail implements identity.Requester.
func (d *dummyUser) GetEmail() string {
	panic("unimplemented")
}

// GetGlobalPermissions implements identity.Requester.
func (d *dummyUser) GetGlobalPermissions() map[string][]string {
	panic("unimplemented")
}

// GetID implements identity.Requester.
func (d *dummyUser) GetID() identity.NamespaceID {
	panic("unimplemented")
}

// GetIDToken implements identity.Requester.
func (d *dummyUser) GetIDToken() string {
	panic("unimplemented")
}

// GetIsGrafanaAdmin implements identity.Requester.
func (d *dummyUser) GetIsGrafanaAdmin() bool {
	panic("unimplemented")
}

// GetLogin implements identity.Requester.
func (d *dummyUser) GetLogin() string {
	panic("unimplemented")
}

// GetNamespacedID implements identity.Requester.
func (d *dummyUser) GetNamespacedID() (namespace identity.Namespace, identifier string) {
	panic("unimplemented")
}

// GetOrgID implements identity.Requester.
func (d *dummyUser) GetOrgID() int64 {
	panic("unimplemented")
}

// GetOrgName implements identity.Requester.
func (d *dummyUser) GetOrgName() string {
	panic("unimplemented")
}

// GetOrgRole implements identity.Requester.
func (d *dummyUser) GetOrgRole() identity.RoleType {
	panic("unimplemented")
}

// GetPermissions implements identity.Requester.
func (d *dummyUser) GetPermissions() map[string][]string {
	panic("unimplemented")
}

// GetTeams implements identity.Requester.
func (d *dummyUser) GetTeams() []int64 {
	panic("unimplemented")
}

// GetUID implements identity.Requester.
func (d *dummyUser) GetUID() identity.NamespaceID {
	return identity.NewNamespaceIDString(identity.NamespaceUser, d.UID)
}

// HasRole implements identity.Requester.
func (d *dummyUser) HasRole(role identity.RoleType) bool {
	panic("unimplemented")
}

// HasUniqueId implements identity.Requester.
func (d *dummyUser) HasUniqueId() bool {
	panic("unimplemented")
}

// IsAuthenticatedBy implements identity.Requester.
func (d *dummyUser) IsAuthenticatedBy(providers ...string) bool {
	panic("unimplemented")
}

// IsEmailVerified implements identity.Requester.
func (d *dummyUser) IsEmailVerified() bool {
	panic("unimplemented")
}

// IsNil implements identity.Requester.
func (d *dummyUser) IsNil() bool {
	return false
}

var _ identity.Requester = &dummyUser{}
