package seeding

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type fakeRoleStore struct {
	roles   map[string]*accesscontrol.RoleDTO
	deleted []string
}

func (f *fakeRoleStore) LoadRoles(_ context.Context) (map[string]*accesscontrol.RoleDTO, error) {
	return f.roles, nil
}

func (f *fakeRoleStore) SetRole(_ context.Context, _ *accesscontrol.RoleDTO, _ accesscontrol.RoleDTO) error {
	return nil
}

func (f *fakeRoleStore) SetPermissions(_ context.Context, _ *accesscontrol.RoleDTO, _ accesscontrol.RoleDTO) error {
	return nil
}

func (f *fakeRoleStore) CreateRole(_ context.Context, _ accesscontrol.RoleDTO) error {
	return nil
}

func (f *fakeRoleStore) DeleteRoles(_ context.Context, roleUIDs []string) error {
	f.deleted = append(f.deleted, roleUIDs...)
	return nil
}

func TestSeeder_RemoveAbsentRoles_IncompleteRoleSources(t *testing.T) {
	// Simulates the DB state after IAM roles were persisted on a previous
	// run: one core fixed role (seeded this run) and one IAM-sourced fixed
	// role (not declared this run).
	newStore := func() *fakeRoleStore {
		return &fakeRoleStore{
			roles: map[string]*accesscontrol.RoleDTO{
				"fixed:core:reader": {
					Name: "fixed:core:reader",
					UID:  "core-reader",
				},
				"fixed:issuetrackerproject:reader": {
					Name: "fixed:issuetrackerproject:reader",
					UID:  "iam-reader",
				},
			},
		}
	}

	seedCoreRole := func(t *testing.T, s *Seeder) {
		t.Helper()
		require.NoError(t, s.SeedRoles(context.Background(), []accesscontrol.RoleRegistration{
			{Role: accesscontrol.RoleDTO{Name: "fixed:core:reader", UID: "core-reader"}},
		}))
	}

	t.Run("removes absent fixed roles when all sources are complete", func(t *testing.T) {
		store := newStore()
		seeder := New(log.NewNopLogger(), store, nil)
		seedCoreRole(t, seeder)

		require.NoError(t, seeder.RemoveAbsentRoles(context.Background()))
		assert.Equal(t, []string{"iam-reader"}, store.deleted)
	})

	t.Run("keeps absent fixed roles when a role source is incomplete", func(t *testing.T) {
		store := newStore()
		seeder := New(log.NewNopLogger(), store, nil)
		seedCoreRole(t, seeder)

		seeder.ReportIncompleteRoleSource("accesscontrol.iamrolessyncer")

		require.NoError(t, seeder.RemoveAbsentRoles(context.Background()))
		assert.Empty(t, store.deleted, "no fixed role should be deleted while a role source is incomplete")
	})
}
