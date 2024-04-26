package ngalert

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestUsageReporter(t *testing.T) {
	t.Run("reports org usage", func(t *testing.T) {
		rules := newFakeUsageReader(map[int64]int64{1: 10, 2: 20})
		params := quota.ScopeParameters{
			OrgID: 1,
		}

		res, err := UsageReporter(rules)(context.Background(), &params)

		require.NoError(t, err)
		rulesOrg, _ := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.OrgScope)
		val, ok := res.Get(rulesOrg)
		require.True(t, ok, "reporter did not report on org 1 rules usage")
		require.Equal(t, int64(10), val)
	})

	t.Run("reports global usage", func(t *testing.T) {
		rules := newFakeUsageReader(map[int64]int64{1: 10, 2: 20})
		params := quota.ScopeParameters{
			OrgID: 1,
		}

		res, err := UsageReporter(rules)(context.Background(), &params)

		require.NoError(t, err)
		rulesGlobal, _ := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.GlobalScope)
		val, ok := res.Get(rulesGlobal)
		require.True(t, ok, "reporter did not report on global rules usage")
		require.Equal(t, int64(30), val)
	})

	t.Run("reports global usage if scope params are nil", func(t *testing.T) {
		rules := newFakeUsageReader(map[int64]int64{1: 10, 2: 20})

		res, err := UsageReporter(rules)(context.Background(), nil)

		require.NoError(t, err)
		rulesGlobal, _ := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.GlobalScope)
		val, ok := res.Get(rulesGlobal)
		require.True(t, ok, "reporter did not report on global rules usage")
		require.Equal(t, int64(30), val)
	})
}

func TestReadQuotaConfig(t *testing.T) {
	cfg := &setting.Cfg{
		Quota: setting.QuotaSettings{
			Org: setting.OrgQuota{
				AlertRule: 30,
			},
			Global: setting.GlobalQuota{
				AlertRule: 50,
			},
		},
	}

	t.Run("registers per-org rule quota from config", func(t *testing.T) {
		res, err := readQuotaConfig(cfg)

		require.NoError(t, err)
		rulesOrg, _ := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.OrgScope)
		val, ok := res.Get(rulesOrg)
		require.True(t, ok, "did not configure per-org rules quota")
		require.Equal(t, int64(30), val)
	})

	t.Run("registers global rule quota from config", func(t *testing.T) {
		res, err := readQuotaConfig(cfg)

		require.NoError(t, err)
		rulesGlobal, _ := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.GlobalScope)
		val, ok := res.Get(rulesGlobal)
		require.True(t, ok, "did not configure global rules quota")
		require.Equal(t, int64(50), val)
	})
}

type fakeUsageReader struct {
	usage map[int64]int64 // orgID -> count
}

func newFakeUsageReader(usage map[int64]int64) fakeUsageReader {
	return fakeUsageReader{
		usage: usage,
	}
}

func (f fakeUsageReader) Count(_ context.Context, orgID int64) (int64, error) {
	if orgID == 0 {
		total := int64(0)
		for _, count := range f.usage {
			total += count
		}
		return total, nil
	}

	if c, ok := f.usage[orgID]; ok {
		return c, nil
	}
	return 0, nil
}
