package database

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStore_CreateServiceAccount(t *testing.T) {
	_, store := setupTestDatabase(t)
	t.Run("create service account", func(t *testing.T) {
		serviceAccountName := "new Service Account"
		serviceAccountOrgId := int64(1)

		saDTO, err := store.CreateServiceAccount(context.Background(), serviceAccountOrgId, serviceAccountName)
		require.NoError(t, err)
		assert.Equal(t, "sa-new-service-account", saDTO.Login)
		assert.Equal(t, serviceAccountName, saDTO.Name)
		assert.Equal(t, 0, int(saDTO.Tokens))

		retrieved, err := store.RetrieveServiceAccount(context.Background(), serviceAccountOrgId, saDTO.Id)
		require.NoError(t, err)
		assert.Equal(t, "sa-new-service-account", retrieved.Login)
		assert.Equal(t, serviceAccountName, retrieved.Name)
		assert.Equal(t, serviceAccountOrgId, retrieved.OrgId)

		retrievedId, err := store.RetrieveServiceAccountIdByName(context.Background(), serviceAccountOrgId, serviceAccountName)
		require.NoError(t, err)
		assert.Equal(t, saDTO.Id, retrievedId)
	})
}

func TestStore_DeleteServiceAccount(t *testing.T) {
	cases := []struct {
		desc        string
		user        tests.TestUser
		expectedErr error
	}{
		{
			desc:        "service accounts should exist and get deleted",
			user:        tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			expectedErr: nil,
		},
		{
			desc:        "service accounts is false should not delete the user",
			user:        tests.TestUser{Login: "test1@admin", IsServiceAccount: false},
			expectedErr: serviceaccounts.ErrServiceAccountNotFound,
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			db, store := setupTestDatabase(t)
			user := tests.SetupUserServiceAccount(t, db, c.user)
			err := store.DeleteServiceAccount(context.Background(), user.OrgId, user.Id)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func setupTestDatabase(t *testing.T) (*sqlstore.SQLStore, *ServiceAccountsStoreImpl) {
	t.Helper()
	db := sqlstore.InitTestDB(t)
	return db, NewServiceAccountsStore(db)
}

func TestStore_RetrieveServiceAccount(t *testing.T) {
	cases := []struct {
		desc        string
		user        tests.TestUser
		expectedErr error
	}{
		{
			desc:        "service accounts should exist and get retrieved",
			user:        tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			expectedErr: nil,
		},
		{
			desc:        "service accounts is false should not retrieve user",
			user:        tests.TestUser{Login: "test1@admin", IsServiceAccount: false},
			expectedErr: serviceaccounts.ErrServiceAccountNotFound,
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			db, store := setupTestDatabase(t)
			user := tests.SetupUserServiceAccount(t, db, c.user)
			dto, err := store.RetrieveServiceAccount(context.Background(), user.OrgId, user.Id)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			} else {
				require.NoError(t, err)
				require.Equal(t, c.user.Login, dto.Login)
				require.Len(t, dto.Teams, 0)
			}
		})
	}
}

func TestStore_AddServiceAccountToTeam(t *testing.T) {
	cases := []struct {
		desc        string
		sa          tests.TestUser
		team        tests.TestTeam
		expectedErr error
	}{
		{
			desc:        "should be able to add service account to team",
			sa:          tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			team:        tests.TestTeam{Email: "teamtest1@admin", Name: "test-team"},
			expectedErr: nil,
		},
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			db, store := setupTestDatabase(t)
			sa := tests.SetupUserServiceAccount(t, db, c.sa)
			team, err := db.CreateTeam(c.team.Name, c.team.Email, sa.OrgId)
			if err != nil {
				require.NoError(t, err)
			}
			cmd := &serviceaccounts.AddServiceAccountToTeamCommand{OrgId: sa.OrgId, TeamId: team.Id}
			err = store.AddServiceAccountToTeam(context.Background(), sa.Id, cmd)
			if c.expectedErr != nil {
				require.ErrorIs(t, err, c.expectedErr)
			}
			teamQuery := models.GetTeamMembersQuery{OrgId: sa.OrgId, TeamId: team.Id}
			err = db.GetTeamMembers(context.Background(), &teamQuery)
			require.NoError(t, err)
			require.Equal(t, len(teamQuery.Result), 1)
			require.Equal(t, teamQuery.Result[0].UserId, sa.Id)
			require.Equal(t, teamQuery.Result[0].Permission, models.PERMISSION_VIEW)
		})
	}
}
