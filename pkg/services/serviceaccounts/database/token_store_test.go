package database

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/stretchr/testify/require"
)

func TestStore_AddServiceAccountToken(t *testing.T) {
	userToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	user := tests.SetupUserServiceAccount(t, db, userToCreate)

	type testCasesAdd struct {
		secondsToLive int64
		desc          string
	}

	testCases := []testCasesAdd{{-10, "invalid"}, {0, "no expiry"}, {10, "valid"}}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			keyName := t.Name()
			key, err := apikeygen.New(user.OrgId, keyName)
			require.NoError(t, err)

			cmd := serviceaccounts.AddServiceAccountTokenCommand{
				Name:          keyName,
				OrgId:         user.OrgId,
				Key:           key.HashedKey,
				SecondsToLive: tc.secondsToLive,
				Result:        &models.ApiKey{},
			}

			err = store.AddServiceAccountToken(context.Background(), user.Id, &cmd)
			if tc.secondsToLive < 0 {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			newKey := cmd.Result
			require.Equal(t, t.Name(), newKey.Name)

			// Verify against DB
			keys, errT := store.ListTokens(context.Background(), user.OrgId, user.Id)

			require.NoError(t, errT)

			found := false
			for _, k := range keys {
				if k.Name == keyName {
					found = true
					require.Equal(t, key.HashedKey, newKey.Key)
					if tc.secondsToLive == 0 {
						require.Nil(t, k.Expires)
					} else {
						require.NotNil(t, k.Expires)
					}
				}
			}

			require.True(t, found, "Key not found")
		})
	}
}

func TestStore_DeleteServiceAccountToken(t *testing.T) {
	userToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	user := tests.SetupUserServiceAccount(t, db, userToCreate)

	keyName := t.Name()
	key, err := apikeygen.New(user.OrgId, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         user.OrgId,
		Key:           key.HashedKey,
		SecondsToLive: 0,
		Result:        &models.ApiKey{},
	}

	err = store.AddServiceAccountToken(context.Background(), user.Id, &cmd)
	require.NoError(t, err)
	newKey := cmd.Result

	// Delete key from wrong service account
	err = store.DeleteServiceAccountToken(context.Background(), user.OrgId, user.Id+2, newKey.Id)
	require.Error(t, err)

	// Delete key from wrong org
	err = store.DeleteServiceAccountToken(context.Background(), user.OrgId+2, user.Id, newKey.Id)
	require.Error(t, err)

	err = store.DeleteServiceAccountToken(context.Background(), user.OrgId, user.Id, newKey.Id)
	require.NoError(t, err)

	// Verify against DB
	keys, errT := store.ListTokens(context.Background(), user.OrgId, user.Id)
	require.NoError(t, errT)

	for _, k := range keys {
		if k.Name == keyName {
			require.Fail(t, "Key not deleted")
		}
	}
}
