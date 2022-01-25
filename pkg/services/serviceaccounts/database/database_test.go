package database

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

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
			}
		})
	}
}
