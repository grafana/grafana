package database

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationDashboardSnapshotDBAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlstore := sqlstore.InitTestDB(t)
	dashStore := ProvideStore(sqlstore)

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
			UserId:             1000,
			OrgId:              1,
		}

		err = dashStore.CreateDashboardSnapshot(context.Background(), &cmd)
		require.NoError(t, err)

		t.Run("Should be able to get snapshot by key", func(t *testing.T) {
			query := dashboardsnapshots.GetDashboardSnapshotQuery{Key: "hej"}
			err := dashStore.GetDashboardSnapshot(context.Background(), &query)
			require.NoError(t, err)

			assert.NotNil(t, query.Result)

			decryptedDashboard, err := secretsService.Decrypt(
				context.Background(),
				query.Result.DashboardEncrypted,
			)
			require.NoError(t, err)

			dashboard, err := simplejson.NewJson(decryptedDashboard)
			require.NoError(t, err)

			assert.Equal(t, "mupp", dashboard.Get("hello").MustString())
		})

		t.Run("And the user has the admin role", func(t *testing.T) {
			query := dashboardsnapshots.GetDashboardSnapshotsQuery{
				OrgId:        1,
				SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_ADMIN},
			}
			err := dashStore.SearchDashboardSnapshots(context.Background(), &query)
			require.NoError(t, err)

			t.Run("Should return all the snapshots", func(t *testing.T) {
				assert.NotNil(t, query.Result)
				assert.Len(t, query.Result, 1)
			})
		})

		t.Run("And the user has the editor role and has created a snapshot", func(t *testing.T) {
			query := dashboardsnapshots.GetDashboardSnapshotsQuery{
				OrgId:        1,
				SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_EDITOR, UserId: 1000},
			}
			err := dashStore.SearchDashboardSnapshots(context.Background(), &query)
			require.NoError(t, err)

			t.Run("Should return all the snapshots", func(t *testing.T) {
				require.NotNil(t, query.Result)
				assert.Len(t, query.Result, 1)
			})
		})

		t.Run("And the user has the editor role and has not created any snapshot", func(t *testing.T) {
			query := dashboardsnapshots.GetDashboardSnapshotsQuery{
				OrgId:        1,
				SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_EDITOR, UserId: 2},
			}
			err := dashStore.SearchDashboardSnapshots(context.Background(), &query)
			require.NoError(t, err)

			t.Run("Should not return any snapshots", func(t *testing.T) {
				require.NotNil(t, query.Result)
				assert.Empty(t, query.Result)
			})
		})

		t.Run("And the user is anonymous", func(t *testing.T) {
			cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{
				Key:       "strangesnapshotwithuserid0",
				DeleteKey: "adeletekey",
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"hello": "mupp",
				}),
				UserId: 0,
				OrgId:  1,
			}
			err := dashStore.CreateDashboardSnapshot(context.Background(), &cmd)
			require.NoError(t, err)

			t.Run("Should not return any snapshots", func(t *testing.T) {
				query := dashboardsnapshots.GetDashboardSnapshotsQuery{
					OrgId:        1,
					SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_EDITOR, IsAnonymous: true, UserId: 0},
				}
				err := dashStore.SearchDashboardSnapshots(context.Background(), &query)
				require.NoError(t, err)

				require.NotNil(t, query.Result)
				assert.Empty(t, query.Result)
			})
		})

		t.Run("Should have encrypted dashboard data", func(t *testing.T) {
			decryptedDashboard, err := secretsService.Decrypt(
				context.Background(),
				cmd.Result.DashboardEncrypted,
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
	sqlstore := sqlstore.InitTestDB(t)
	dashStore := ProvideStore(sqlstore)

	t.Run("Testing dashboard snapshots clean up", func(t *testing.T) {
		setting.SnapShotRemoveExpired = true

		nonExpiredSnapshot := createTestSnapshot(t, dashStore, "key1", 48000)
		createTestSnapshot(t, dashStore, "key2", -1200)
		createTestSnapshot(t, dashStore, "key3", -1200)

		err := dashStore.DeleteExpiredSnapshots(context.Background(), &dashboardsnapshots.DeleteExpiredSnapshotsCommand{})
		require.NoError(t, err)

		query := dashboardsnapshots.GetDashboardSnapshotsQuery{
			OrgId:        1,
			SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_ADMIN},
		}
		err = dashStore.SearchDashboardSnapshots(context.Background(), &query)
		require.NoError(t, err)

		assert.Len(t, query.Result, 1)
		assert.Equal(t, nonExpiredSnapshot.Key, query.Result[0].Key)

		err = dashStore.DeleteExpiredSnapshots(context.Background(), &dashboardsnapshots.DeleteExpiredSnapshotsCommand{})
		require.NoError(t, err)

		query = dashboardsnapshots.GetDashboardSnapshotsQuery{
			OrgId:        1,
			SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_ADMIN},
		}
		err = dashStore.SearchDashboardSnapshots(context.Background(), &query)
		require.NoError(t, err)

		require.Len(t, query.Result, 1)
		require.Equal(t, nonExpiredSnapshot.Key, query.Result[0].Key)
	})
}

func createTestSnapshot(t *testing.T, dashStore *DashboardSnapshotStore, key string, expires int64) *dashboardsnapshots.DashboardSnapshot {
	cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{
		Key:       key,
		DeleteKey: "delete" + key,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"hello": "mupp",
		}),
		UserId:  1000,
		OrgId:   1,
		Expires: expires,
	}
	err := dashStore.CreateDashboardSnapshot(context.Background(), &cmd)
	require.NoError(t, err)

	// Set expiry date manually - to be able to create expired snapshots
	if expires < 0 {
		expireDate := time.Now().Add(time.Second * time.Duration(expires))
		err = dashStore.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			_, err := sess.Exec("UPDATE dashboard_snapshot SET expires = ? WHERE id = ?", expireDate, cmd.Result.Id)
			return err
		})
		require.NoError(t, err)
	}

	return cmd.Result
}
