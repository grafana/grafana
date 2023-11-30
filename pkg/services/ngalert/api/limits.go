package api

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/quota"
)

func UsageReporter(store RuleStore) quota.UsageReporterFunc {
	return func(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
		u := &quota.Map{}

		var orgID int64 = 0
		if scopeParams != nil {
			orgID = scopeParams.OrgID
		}

		if orgUsage, err := store.Count(ctx, orgID); err != nil {
			return u, err
		} else {
			tag, err := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.OrgScope)
			if err != nil {
				return u, err
			}
			u.Set(tag, orgUsage)
		}

		if globalUsage, err := store.Count(ctx, 0); err != nil {
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
