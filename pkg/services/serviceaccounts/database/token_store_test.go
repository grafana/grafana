package database

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/services/apikey"
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
			key, err := apikeygen.New(user.OrgID, keyName)
			require.NoError(t, err)

			cmd := serviceaccounts.AddServiceAccountTokenCommand{
				Name:          keyName,
				OrgId:         user.OrgID,
				Key:           key.HashedKey,
				SecondsToLive: tc.secondsToLive,
				Result:        &apikey.APIKey{},
			}

			err = store.AddServiceAccountToken(context.Background(), user.ID, &cmd)
			if tc.secondsToLive < 0 {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			newKey := cmd.Result
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

func TestStore_AddServiceAccountToken_WrongServiceAccount(t *testing.T) {
	saToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	sa := tests.SetupUserServiceAccount(t, db, saToCreate)

	keyName := t.Name()
	key, err := apikeygen.New(sa.OrgID, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         sa.OrgID,
		Key:           key.HashedKey,
		SecondsToLive: 0,
		Result:        &apikey.APIKey{},
	}

	err = store.AddServiceAccountToken(context.Background(), sa.ID+1, &cmd)
	require.Error(t, err, "It should not be possible to add token to non-existing service account")
}

func TestIntegrationStore_UpdateAPIKeysExpiryDate(t *testing.T) {
	saToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	sa := tests.SetupUserServiceAccount(t, db, saToCreate)

	keyName := t.Name()
	key, err := apikeygen.New(sa.OrgID, keyName)
	require.NoError(t, err, "An error has occurred when greating a service account token")

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         sa.OrgID,
		Key:           key.HashedKey,
		SecondsToLive: 0,
		Result:        &apikey.APIKey{},
	}
	err = store.AddServiceAccountToken(context.Background(), sa.ID, &cmd)
	require.NoError(t, err, "An error has occurred when adding an access token to  a service account")
	err = store.UpdateAPIKeysExpiryDate(context.Background(), 7)
	require.NoError(t, err, "An error has occurred when updating the Expiry dates")

	tokens, err := store.ListTokens(context.Background(), &serviceaccounts.GetSATokensQuery{})
	require.NoError(t, err, "An error has occurred when listing tokens")
	require.Equal(t, len(tokens), 1, "There should only be one token created")
	require.NotNil(t, tokens[0].Expires, "The only token created should have a modified expiry date")
}

func TestStore_RevokeServiceAccountToken(t *testing.T) {
	userToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	sa := tests.SetupUserServiceAccount(t, db, userToCreate)

	keyName := t.Name()
	key, err := apikeygen.New(sa.OrgID, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         sa.OrgID,
		Key:           key.HashedKey,
		SecondsToLive: 0,
		Result:        &apikey.APIKey{},
	}

	err = store.AddServiceAccountToken(context.Background(), sa.ID, &cmd)
	require.NoError(t, err)
	newKey := cmd.Result

	// Revoke SAT
	err = store.RevokeServiceAccountToken(context.Background(), sa.OrgID, sa.ID, newKey.Id)
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

func TestStore_DeleteServiceAccountToken(t *testing.T) {
	userToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	sa := tests.SetupUserServiceAccount(t, db, userToCreate)

	keyName := t.Name()
	key, err := apikeygen.New(sa.OrgID, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         sa.OrgID,
		Key:           key.HashedKey,
		SecondsToLive: 0,
		Result:        &apikey.APIKey{},
	}

	err = store.AddServiceAccountToken(context.Background(), sa.ID, &cmd)
	require.NoError(t, err)
	newKey := cmd.Result

	// Delete key from wrong service account
	err = store.DeleteServiceAccountToken(context.Background(), sa.OrgID, sa.ID+2, newKey.Id)
	require.Error(t, err)

	// Delete key from wrong org
	err = store.DeleteServiceAccountToken(context.Background(), sa.OrgID+2, sa.ID, newKey.Id)
	require.Error(t, err)

	err = store.DeleteServiceAccountToken(context.Background(), sa.OrgID, sa.ID, newKey.Id)
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
