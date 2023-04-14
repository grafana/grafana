package database

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationDashboardSnapshotDBAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlstore := db.InitTestDB(t)
	dashStore := ProvideStore(sqlstore, setting.NewCfg())

	origSecret := setting.SecretKey
	setting.SecretKey = "dashboard_snapshot_testing"
	t.Cleanup(func() {
		setting.SecretKey = origSecret
	})
	secretsService := fakes.NewFakeSecretsService()
	dashboard := simplejson.NewFromAny(map[string]interface{}{"hello": "mupp"})

	t.Run("Given saved snapshot", func(t *testing.T) {
		rawDashboard, err := dashboard.Encode()
		require.NoError(t, err)

		encryptedDashboard, err := secretsService.Encrypt(context.Background(), rawDashboard, secrets.WithoutScope())
		require.NoError(t, err)

		cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{
			Key:                "hej",
			DashboardEncrypted: encryptedDashboard,
			UserID:             1000,
			OrgID:              1,
		}

		result, err := dashStore.CreateDashboardSnapshot(context.Background(), &cmd)
		require.NoError(t, err)

		t.Run("Should be able to get snapshot by key", func(t *testing.T) {
			query := dashboardsnapshots.GetDashboardSnapshotQuery{Key: "hej"}
			queryResult, err := dashStore.GetDashboardSnapshot(context.Background(), &query)
			require.NoError(t, err)

			assert.NotNil(t, queryResult)

			decryptedDashboard, err := secretsService.Decrypt(
				context.Background(),
				queryResult.DashboardEncrypted,
			)
			require.NoError(t, err)

			dashboard, err := simplejson.NewJson(decryptedDashboard)
			require.NoError(t, err)

			assert.Equal(t, "mupp", dashboard.Get("hello").MustString())
		})

		t.Run("And the user has the admin role", func(t *testing.T) {
			query := dashboardsnapshots.GetDashboardSnapshotsQuery{
				OrgID:        1,
				SignedInUser: &user.SignedInUser{OrgRole: org.RoleAdmin},
			}
			queryResult, err := dashStore.SearchDashboardSnapshots(context.Background(), &query)
			require.NoError(t, err)

			t.Run("Should return all the snapshots", func(t *testing.T) {
				assert.NotNil(t, queryResult)
				assert.Len(t, queryResult, 1)
			})
		})

		t.Run("And the user has the editor role and has created a snapshot", func(t *testing.T) {
			query := dashboardsnapshots.GetDashboardSnapshotsQuery{
				OrgID:        1,
				SignedInUser: &user.SignedInUser{OrgRole: org.RoleEditor, UserID: 1000},
			}
			queryResult, err := dashStore.SearchDashboardSnapshots(context.Background(), &query)
			require.NoError(t, err)

			t.Run("Should return all the snapshots", func(t *testing.T) {
				require.NotNil(t, queryResult)
				assert.Len(t, queryResult, 1)
			})
		})

		t.Run("And the user has the editor role and has not created any snapshot", func(t *testing.T) {
			query := dashboardsnapshots.GetDashboardSnapshotsQuery{
				OrgID:        1,
				SignedInUser: &user.SignedInUser{OrgRole: org.RoleEditor, UserID: 2},
			}
			queryResult, err := dashStore.SearchDashboardSnapshots(context.Background(), &query)
			require.NoError(t, err)

			t.Run("Should not return any snapshots", func(t *testing.T) {
				require.NotNil(t, queryResult)
				assert.Empty(t, queryResult)
			})
		})

		t.Run("And the user is anonymous", func(t *testing.T) {
			cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{
				Key:       "strangesnapshotwithuserid0",
				DeleteKey: "adeletekey",
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"hello": "mupp",
				}),
				UserID: 0,
				OrgID:  1,
			}
			_, err := dashStore.CreateDashboardSnapshot(context.Background(), &cmd)
			require.NoError(t, err)

			t.Run("Should not return any snapshots", func(t *testing.T) {
				query := dashboardsnapshots.GetDashboardSnapshotsQuery{
					OrgID:        1,
					SignedInUser: &user.SignedInUser{OrgRole: org.RoleEditor, IsAnonymous: true, UserID: 0},
				}
				queryResult, err := dashStore.SearchDashboardSnapshots(context.Background(), &query)
				require.NoError(t, err)

				require.NotNil(t, queryResult)
				assert.Empty(t, queryResult)
			})
		})

		t.Run("Should have encrypted dashboard data", func(t *testing.T) {
			decryptedDashboard, err := secretsService.Decrypt(
				context.Background(),
				result.DashboardEncrypted,
			)
			require.NoError(t, err)

			require.Equal(t, decryptedDashboard, rawDashboard)
		})
	})
}

func TestIntegrationDeleteExpiredSnapshots(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlstore := db.InitTestDB(t)
	dashStore := ProvideStore(sqlstore, setting.NewCfg())

	t.Run("Testing dashboard snapshots clean up", func(t *testing.T) {
		dashStore.cfg.SnapShotRemoveExpired = true

		nonExpiredSnapshot := createTestSnapshot(t, dashStore, "key1", 48000)
		createTestSnapshot(t, dashStore, "key2", -1200)
		createTestSnapshot(t, dashStore, "key3", -1200)

		err := dashStore.DeleteExpiredSnapshots(context.Background(), &dashboardsnapshots.DeleteExpiredSnapshotsCommand{})
		require.NoError(t, err)

		query := dashboardsnapshots.GetDashboardSnapshotsQuery{
			OrgID:        1,
			SignedInUser: &user.SignedInUser{OrgRole: org.RoleAdmin},
		}
		queryResult, err := dashStore.SearchDashboardSnapshots(context.Background(), &query)
		require.NoError(t, err)

		assert.Len(t, queryResult, 1)
		assert.Equal(t, nonExpiredSnapshot.Key, queryResult[0].Key)

		err = dashStore.DeleteExpiredSnapshots(context.Background(), &dashboardsnapshots.DeleteExpiredSnapshotsCommand{})
		require.NoError(t, err)

		query = dashboardsnapshots.GetDashboardSnapshotsQuery{
			OrgID:        1,
			SignedInUser: &user.SignedInUser{OrgRole: org.RoleAdmin},
		}
		queryResult, err = dashStore.SearchDashboardSnapshots(context.Background(), &query)
		require.NoError(t, err)

		require.Len(t, queryResult, 1)
		require.Equal(t, nonExpiredSnapshot.Key, queryResult[0].Key)
	})
}

func createTestSnapshot(t *testing.T, dashStore *DashboardSnapshotStore, key string, expires int64) *dashboardsnapshots.DashboardSnapshot {
	cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{
		Key:       key,
		DeleteKey: "delete" + key,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"hello": "mupp",
		}),
		UserID:  1000,
		OrgID:   1,
		Expires: expires,
	}
	result, err := dashStore.CreateDashboardSnapshot(context.Background(), &cmd)
	require.NoError(t, err)

	// Set expiry date manually - to be able to create expired snapshots
	if expires < 0 {
		expireDate := time.Now().Add(time.Second * time.Duration(expires))
		err = dashStore.store.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Exec("UPDATE dashboard_snapshot SET expires = ? WHERE id = ?", expireDate, result.ID)
			return err
		})
		require.NoError(t, err)
	}

	return result
}
