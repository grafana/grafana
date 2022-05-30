//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestIntegrationQuotaCommandsAndQueries(t *testing.T) {
	sqlStore := InitTestDB(t)
	userId := int64(1)
	orgId := int64(0)

	setting.Quota = setting.QuotaSettings{
		Enabled: true,
		Org: &setting.OrgQuota{
			User:       5,
			Dashboard:  5,
			DataSource: 5,
			ApiKey:     5,
			AlertRule:  5,
		},
		User: &setting.UserQuota{
			Org: 5,
		},
		Global: &setting.GlobalQuota{
			Org:        5,
			User:       5,
			Dashboard:  5,
			DataSource: 5,
			ApiKey:     5,
			Session:    5,
			AlertRule:  5,
		},
	}

	// create a new org and add user_id 1 as admin.
	// we will then have an org with 1 user. and a user
	// with 1 org.
	userCmd := models.CreateOrgCommand{
		Name:   "TestOrg",
		UserId: 1,
	}

	err := sqlStore.CreateOrg(context.Background(), &userCmd)
	require.NoError(t, err)
	orgId = userCmd.Result.Id

	t.Run("Given saved org quota for users", func(t *testing.T) {
		orgCmd := models.UpdateOrgQuotaCmd{
			OrgId:  orgId,
			Target: "org_user",
			Limit:  10,
		}
		err := sqlStore.UpdateOrgQuota(context.Background(), &orgCmd)
		require.NoError(t, err)

		t.Run("Should be able to get saved quota by org id and target", func(t *testing.T) {
			query := models.GetOrgQuotaByTargetQuery{OrgId: orgId, Target: "org_user", Default: 1}
			err = sqlStore.GetOrgQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(10), query.Result.Limit)
		})

		t.Run("Should be able to get default quota by org id and target", func(t *testing.T) {
			query := models.GetOrgQuotaByTargetQuery{OrgId: 123, Target: "org_user", Default: 11}
			err = sqlStore.GetOrgQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(11), query.Result.Limit)
		})

		t.Run("Should be able to get used org quota when rows exist", func(t *testing.T) {
			query := models.GetOrgQuotaByTargetQuery{OrgId: orgId, Target: "org_user", Default: 11}
			err = sqlStore.GetOrgQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(1), query.Result.Used)
		})

		t.Run("Should be able to get used org quota when no rows exist", func(t *testing.T) {
			query := models.GetOrgQuotaByTargetQuery{OrgId: 2, Target: "org_user", Default: 11}
			err = sqlStore.GetOrgQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(0), query.Result.Used)
		})

		t.Run("Should be able to get zero used org alert quota when table does not exist (ngalert is not enabled - default case)", func(t *testing.T) {
			query := models.GetOrgQuotaByTargetQuery{OrgId: 2, Target: "alert", Default: 11}
			err = sqlStore.GetOrgQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(0), query.Result.Used)
		})

		t.Run("Should be able to quota list for org", func(t *testing.T) {
			query := models.GetOrgQuotasQuery{OrgId: orgId}
			err = sqlStore.GetOrgQuotas(context.Background(), &query)

			require.NoError(t, err)
			require.Len(t, query.Result, 5)
			for _, res := range query.Result {
				limit := int64(5) // default quota limit
				used := int64(0)
				if res.Target == "org_user" {
					limit = 10 // customized quota limit.
					used = 1
				}
				require.Equal(t, limit, res.Limit)
				require.Equal(t, used, res.Used)
			}
		})
	})

	t.Run("Given saved org quota for dashboards", func(t *testing.T) {
		orgCmd := models.UpdateOrgQuotaCmd{
			OrgId:  orgId,
			Target: dashboardTarget,
			Limit:  10,
		}
		err := sqlStore.UpdateOrgQuota(context.Background(), &orgCmd)
		require.NoError(t, err)

		t.Run("Should be able to get saved quota by org id and target", func(t *testing.T) {
			query := models.GetOrgQuotaByTargetQuery{OrgId: orgId, Target: dashboardTarget, Default: 1}
			err = sqlStore.GetOrgQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(10), query.Result.Limit)
			require.Equal(t, int64(0), query.Result.Used)
		})
	})

	t.Run("Given saved user quota for org", func(t *testing.T) {
		userQuotaCmd := models.UpdateUserQuotaCmd{
			UserId: userId,
			Target: "org_user",
			Limit:  10,
		}
		err := sqlStore.UpdateUserQuota(context.Background(), &userQuotaCmd)
		require.NoError(t, err)

		t.Run("Should be able to get saved quota by user id and target", func(t *testing.T) {
			query := models.GetUserQuotaByTargetQuery{UserId: userId, Target: "org_user", Default: 1}
			err = sqlStore.GetUserQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(10), query.Result.Limit)
		})

		t.Run("Should be able to get default quota by user id and target", func(t *testing.T) {
			query := models.GetUserQuotaByTargetQuery{UserId: 9, Target: "org_user", Default: 11}
			err = sqlStore.GetUserQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(11), query.Result.Limit)
		})

		t.Run("Should be able to get used user quota when rows exist", func(t *testing.T) {
			query := models.GetUserQuotaByTargetQuery{UserId: userId, Target: "org_user", Default: 11}
			err = sqlStore.GetUserQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(1), query.Result.Used)
		})

		t.Run("Should be able to get used user quota when no rows exist", func(t *testing.T) {
			query := models.GetUserQuotaByTargetQuery{UserId: 2, Target: "org_user", Default: 11}
			err = sqlStore.GetUserQuotaByTarget(context.Background(), &query)

			require.NoError(t, err)
			require.Equal(t, int64(0), query.Result.Used)
		})

		t.Run("Should be able to quota list for user", func(t *testing.T) {
			query := models.GetUserQuotasQuery{UserId: userId}
			err = sqlStore.GetUserQuotas(context.Background(), &query)

			require.NoError(t, err)
			require.Len(t, query.Result, 1)
			require.Equal(t, int64(10), query.Result[0].Limit)
			require.Equal(t, int64(1), query.Result[0].Used)
		})
	})

	t.Run("Should be able to global user quota", func(t *testing.T) {
		query := models.GetGlobalQuotaByTargetQuery{Target: "user", Default: 5}
		err = sqlStore.GetGlobalQuotaByTarget(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, int64(5), query.Result.Limit)
		require.Equal(t, int64(0), query.Result.Used)
	})

	t.Run("Should be able to global org quota", func(t *testing.T) {
		query := models.GetGlobalQuotaByTargetQuery{Target: "org", Default: 5}
		err = sqlStore.GetGlobalQuotaByTarget(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, int64(5), query.Result.Limit)
		require.Equal(t, int64(1), query.Result.Used)
	})

	t.Run("Should be able to get zero used global alert quota when table does not exist (ngalert is not enabled - default case)", func(t *testing.T) {
		query := models.GetGlobalQuotaByTargetQuery{Target: "alert_rule", Default: 5}
		err = sqlStore.GetGlobalQuotaByTarget(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, int64(5), query.Result.Limit)
		require.Equal(t, int64(0), query.Result.Used)
	})

	t.Run("Should be able to global dashboard quota", func(t *testing.T) {
		query := models.GetGlobalQuotaByTargetQuery{Target: dashboardTarget, Default: 5}
		err = sqlStore.GetGlobalQuotaByTarget(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, int64(5), query.Result.Limit)
		require.Equal(t, int64(0), query.Result.Used)
	})

	// related: https://github.com/grafana/grafana/issues/14342
	t.Run("Should org quota updating is successful even if it called multiple time", func(t *testing.T) {
		orgCmd := models.UpdateOrgQuotaCmd{
			OrgId:  orgId,
			Target: "org_user",
			Limit:  5,
		}
		err := sqlStore.UpdateOrgQuota(context.Background(), &orgCmd)
		require.NoError(t, err)

		query := models.GetOrgQuotaByTargetQuery{OrgId: orgId, Target: "org_user", Default: 1}
		err = sqlStore.GetOrgQuotaByTarget(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, int64(5), query.Result.Limit)

		// XXX: resolution of `Updated` column is 1sec, so this makes delay
		time.Sleep(1 * time.Second)

		orgCmd = models.UpdateOrgQuotaCmd{
			OrgId:  orgId,
			Target: "org_user",
			Limit:  10,
		}
		err = sqlStore.UpdateOrgQuota(context.Background(), &orgCmd)
		require.NoError(t, err)

		query = models.GetOrgQuotaByTargetQuery{OrgId: orgId, Target: "org_user", Default: 1}
		err = sqlStore.GetOrgQuotaByTarget(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, int64(10), query.Result.Limit)
	})

	// related: https://github.com/grafana/grafana/issues/14342
	t.Run("Should user quota updating is successful even if it called multiple time", func(t *testing.T) {
		userQuotaCmd := models.UpdateUserQuotaCmd{
			UserId: userId,
			Target: "org_user",
			Limit:  5,
		}
		err := sqlStore.UpdateUserQuota(context.Background(), &userQuotaCmd)
		require.NoError(t, err)

		query := models.GetUserQuotaByTargetQuery{UserId: userId, Target: "org_user", Default: 1}
		err = sqlStore.GetUserQuotaByTarget(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, int64(5), query.Result.Limit)

		// XXX: resolution of `Updated` column is 1sec, so this makes delay
		time.Sleep(1 * time.Second)

		userQuotaCmd = models.UpdateUserQuotaCmd{
			UserId: userId,
			Target: "org_user",
			Limit:  10,
		}
		err = sqlStore.UpdateUserQuota(context.Background(), &userQuotaCmd)
		require.NoError(t, err)

		query = models.GetUserQuotaByTargetQuery{UserId: userId, Target: "org_user", Default: 1}
		err = sqlStore.GetUserQuotaByTarget(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, int64(10), query.Result.Limit)
	})
}
