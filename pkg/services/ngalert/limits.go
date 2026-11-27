package ngalert

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
)

func RegisterQuotas(cfg *setting.Cfg, qs quota.Service, rules rulestore.RuleCounter) error {
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

func UsageReporter(rules rulestore.RuleCounter) quota.UsageReporterFunc {
	return func(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
		u := &quota.Map{}

		var orgID int64 = 0
		if scopeParams != nil {
			orgID = scopeParams.OrgID
		}

		counts, err := rules.CountByOrg(ctx)
		if err != nil {
			return u, err
		}

		var globalUsage int64
		for _, c := range counts {
			globalUsage += c
		}

		// Without an org in scope, the org usage matches the previous behavior of counting all rules.
		orgUsage := globalUsage
		if orgID != 0 {
			orgUsage = counts[orgID]
		}

		orgTag, err := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.OrgScope)
		if err != nil {
			return u, err
		}
		u.Set(orgTag, orgUsage)

		globalTag, err := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.GlobalScope)
		if err != nil {
			return u, err
		}
		u.Set(globalTag, globalUsage)

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
