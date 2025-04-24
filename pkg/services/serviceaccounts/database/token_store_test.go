package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
)

func TestIntegration_Store_AddServiceAccountToken(t *testing.T) {
	userToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	user := tests.SetupUserServiceAccount(t, db, store.cfg, userToCreate)

	type testCasesAdd struct {
		secondsToLive int64
		desc          string
	}

	testCases := []testCasesAdd{{-10, "invalid"}, {0, "no expiry"}, {10, "valid"}}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			keyName := t.Name()
			key, err := apikeygen.New(user.OrgID, keyName)
			require.NoError(t, err)

			cmd := serviceaccounts.AddServiceAccountTokenCommand{
				Name:          keyName,
				OrgId:         user.OrgID,
				Key:           key.HashedKey,
				SecondsToLive: tc.secondsToLive,
			}

			newKey, err := store.AddServiceAccountToken(context.Background(), user.ID, &cmd)
			if tc.secondsToLive < 0 {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, t.Name(), newKey.Name)

			// Verify against DB
			keys, errT := store.ListTokens(context.Background(), &serviceaccounts.GetSATokensQuery{
				OrgID:            &user.OrgID,
				ServiceAccountID: &user.ID,
			})

			require.NoError(t, errT)

			found := false
			for _, k := range keys {
				if k.Name == keyName {
					found = true
					require.Equal(t, key.HashedKey, newKey.Key)
					require.False(t, *k.IsRevoked)

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

func TestIntegration_Store_AddServiceAccountToken_WrongServiceAccount(t *testing.T) {
	saToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	sa := tests.SetupUserServiceAccount(t, db, store.cfg, saToCreate)

	keyName := t.Name()
	key, err := apikeygen.New(sa.OrgID, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         sa.OrgID,
		Key:           key.HashedKey,
		SecondsToLive: 0,
	}

	_, err = store.AddServiceAccountToken(context.Background(), sa.ID+1, &cmd)
	require.Error(t, err, "It should not be possible to add token to non-existing service account")
}

func TestIntegration_Store_RevokeServiceAccountToken(t *testing.T) {
	userToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	sa := tests.SetupUserServiceAccount(t, db, store.cfg, userToCreate)

	keyName := t.Name()
	key, err := apikeygen.New(sa.OrgID, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         sa.OrgID,
		Key:           key.HashedKey,
		SecondsToLive: 0,
	}

	newKey, err := store.AddServiceAccountToken(context.Background(), sa.ID, &cmd)
	require.NoError(t, err)

	// Revoke SAT
	err = store.RevokeServiceAccountToken(context.Background(), sa.OrgID, sa.ID, newKey.ID)
	require.NoError(t, err)

	// Verify against DB
	keys, errT := store.ListTokens(context.Background(), &serviceaccounts.GetSATokensQuery{
		OrgID:            &sa.OrgID,
		ServiceAccountID: &sa.ID,
	})
	require.NoError(t, errT)

	for _, k := range keys {
		if k.Name == keyName {
			require.True(t, *k.IsRevoked)
			return
		}
	}

	require.Fail(t, "Key not found")
}

func TestIntegration_Store_DeleteServiceAccountToken(t *testing.T) {
	userToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	sa := tests.SetupUserServiceAccount(t, db, store.cfg, userToCreate)

	keyName := t.Name()
	key, err := apikeygen.New(sa.OrgID, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         sa.OrgID,
		Key:           key.HashedKey,
		SecondsToLive: 0,
	}

	newKey, err := store.AddServiceAccountToken(context.Background(), sa.ID, &cmd)
	require.NoError(t, err)

	// Delete key from wrong service account
	err = store.DeleteServiceAccountToken(context.Background(), sa.OrgID, sa.ID+2, newKey.ID)
	require.Error(t, err)

	// Delete key from wrong org
	err = store.DeleteServiceAccountToken(context.Background(), sa.OrgID+2, sa.ID, newKey.ID)
	require.Error(t, err)

	err = store.DeleteServiceAccountToken(context.Background(), sa.OrgID, sa.ID, newKey.ID)
	require.NoError(t, err)

	// Verify against DB
	keys, errT := store.ListTokens(context.Background(), &serviceaccounts.GetSATokensQuery{
		OrgID:            &sa.OrgID,
		ServiceAccountID: &sa.ID,
	})
	require.NoError(t, errT)

	for _, k := range keys {
		if k.Name == keyName {
			require.Fail(t, "Key not deleted")
		}
	}
}
