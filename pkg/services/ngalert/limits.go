package ngalert

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
)

type RuleUsageReader interface {
	Count(ctx context.Context, orgID int64) (int64, error)
}

func RegisterQuotas(settingsProvider setting.SettingsProvider, qs quota.Service, rules RuleUsageReader) error {
	cfg := settingsProvider.Get()
	defaultLimits, err := readQuotaConfig(cfg)
	if err != nil {
		return err
	}

	return qs.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     models.QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      UsageReporter(rules),
	})
}

func UsageReporter(rules RuleUsageReader) quota.UsageReporterFunc {
	return func(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
		u := &quota.Map{}

		var orgID int64 = 0
		if scopeParams != nil {
			orgID = scopeParams.OrgID
		}

		if orgUsage, err := rules.Count(ctx, orgID); err != nil {
			return u, err
		} else {
			tag, err := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.OrgScope)
			if err != nil {
				return u, err
			}
			u.Set(tag, orgUsage)
		}

		if globalUsage, err := rules.Count(ctx, 0); err != nil {
			return u, err
		} else {
			tag, err := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.GlobalScope)
			if err != nil {
				return u, err
			}
			u.Set(tag, globalUsage)
		}

		return u, nil
	}
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

	if cfg == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return limits, err
	}
	orgQuotaTag, err := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.OrgScope)
	if err != nil {
		return limits, err
	}

	limits.Set(globalQuotaTag, cfg.Quota.Global.AlertRule)
	limits.Set(orgQuotaTag, cfg.Quota.Org.AlertRule)
	return limits, nil
}
