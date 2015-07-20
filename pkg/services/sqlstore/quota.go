package sqlstore

import (
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetQuotaByTarget)
	bus.AddHandler("sql", GetQuotas)
	bus.AddHandler("sql", UpdateQuota)
}

type targetCount struct {
	Count int64
}

func GetQuotaByTarget(query *m.GetQuotaByTargetQuery) error {
	quota := m.Quota{
		Target: query.Target,
		OrgId:  query.OrgId,
	}
	has, err := x.Get(quota)
	if err != nil {
		return err
	} else if has == false {
		quota.Limit = m.DefaultQuotas[query.Target]
	}

	//get quota used.
	rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where org_id=?", dialect.Quote(string(query.Target)))
	resp := make([]*targetCount, 0)
	if err := x.Sql(rawSql, query.OrgId).Find(&resp); err != nil {
		return err
	}

	query.Result = &m.QuotaDTO{
		Target: query.Target,
		Limit:  quota.Limit,
		OrgId:  query.OrgId,
		Used:   resp[0].Count,
	}

	return nil
}

func GetQuotas(query *m.GetQuotasQuery) error {
	quotas := make([]*m.Quota, 0)
	sess := x.Table("quota")
	if err := sess.Where("org_id=?", query.OrgId).Find(&quotas); err != nil {
		return err
	}

	seenTargets := make(map[m.QuotaTarget]bool)
	for _, q := range quotas {
		seenTargets[q.Target] = true
	}

	for t, v := range m.DefaultQuotas {
		if _, ok := seenTargets[t]; !ok {
			quotas = append(quotas, &m.Quota{
				OrgId:  query.OrgId,
				Target: t,
				Limit:  v,
			})
		}
	}
	result := make([]*m.QuotaDTO, len(quotas))
	for i, q := range quotas {
		//get quota used.
		rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where org_id=?", dialect.Quote(string(q.Target)))
		resp := make([]*targetCount, 0)
		if err := x.Sql(rawSql, q.OrgId).Find(&resp); err != nil {
			return err
		}
		result[i] = &m.QuotaDTO{
			Target: q.Target,
			Limit:  q.Limit,
			OrgId:  q.OrgId,
			Used:   resp[0].Count,
		}
	}
	query.Result = result
	return nil
}

func UpdateQuota(cmd *m.UpdateQuotaCmd) error {
	return nil
}
