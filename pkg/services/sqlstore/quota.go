package sqlstore

import (
	"fmt"
	"github.com/wangy1931/grafana/pkg/bus"
	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/wangy1931/grafana/pkg/setting"
)

func init() {
	bus.AddHandler("sql", GetOrgQuotaByTarget)
	bus.AddHandler("sql", GetOrgQuotas)
	bus.AddHandler("sql", UpdateOrgQuota)
	bus.AddHandler("sql", GetUserQuotaByTarget)
	bus.AddHandler("sql", GetUserQuotas)
	bus.AddHandler("sql", UpdateUserQuota)
	bus.AddHandler("sql", GetGlobalQuotaByTarget)
}

type targetCount struct {
	Count int64
}

func GetOrgQuotaByTarget(query *m.GetOrgQuotaByTargetQuery) error {
	quota := m.Quota{
		Target: query.Target,
		OrgId:  query.OrgId,
	}
	has, err := x.Get(&quota)
	if err != nil {
		return err
	} else if has == false {
		quota.Limit = query.Default
	}

	//get quota used.
	rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where org_id=?", dialect.Quote(query.Target))
	resp := make([]*targetCount, 0)
	if err := x.Sql(rawSql, query.OrgId).Find(&resp); err != nil {
		return err
	}

	query.Result = &m.OrgQuotaDTO{
		Target: query.Target,
		Limit:  quota.Limit,
		OrgId:  query.OrgId,
		Used:   resp[0].Count,
	}

	return nil
}

func GetOrgQuotas(query *m.GetOrgQuotasQuery) error {
	quotas := make([]*m.Quota, 0)
	sess := x.Table("quota")
	if err := sess.Where("org_id=? AND user_id=0", query.OrgId).Find(&quotas); err != nil {
		return err
	}

	defaultQuotas := setting.Quota.Org.ToMap()

	seenTargets := make(map[string]bool)
	for _, q := range quotas {
		seenTargets[q.Target] = true
	}

	for t, v := range defaultQuotas {
		if _, ok := seenTargets[t]; !ok {
			quotas = append(quotas, &m.Quota{
				OrgId:  query.OrgId,
				Target: t,
				Limit:  v,
			})
		}
	}

	result := make([]*m.OrgQuotaDTO, len(quotas))
	for i, q := range quotas {
		//get quota used.
		rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where org_id=?", dialect.Quote(q.Target))
		resp := make([]*targetCount, 0)
		if err := x.Sql(rawSql, q.OrgId).Find(&resp); err != nil {
			return err
		}
		result[i] = &m.OrgQuotaDTO{
			Target: q.Target,
			Limit:  q.Limit,
			OrgId:  q.OrgId,
			Used:   resp[0].Count,
		}
	}
	query.Result = result
	return nil
}

func UpdateOrgQuota(cmd *m.UpdateOrgQuotaCmd) error {
	return inTransaction2(func(sess *session) error {
		//Check if quota is already defined in the DB
		quota := m.Quota{
			Target: cmd.Target,
			OrgId:  cmd.OrgId,
		}
		has, err := sess.Get(&quota)
		if err != nil {
			return err
		}
		quota.Limit = cmd.Limit
		if has == false {
			//No quota in the DB for this target, so create a new one.
			if _, err := sess.Insert(&quota); err != nil {
				return err
			}
		} else {
			//update existing quota entry in the DB.
			if _, err := sess.Id(quota.Id).Update(&quota); err != nil {
				return err
			}
		}

		return nil
	})
}

func GetUserQuotaByTarget(query *m.GetUserQuotaByTargetQuery) error {
	quota := m.Quota{
		Target: query.Target,
		UserId: query.UserId,
	}
	has, err := x.Get(&quota)
	if err != nil {
		return err
	} else if has == false {
		quota.Limit = query.Default
	}

	//get quota used.
	rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where user_id=?", dialect.Quote(query.Target))
	resp := make([]*targetCount, 0)
	if err := x.Sql(rawSql, query.UserId).Find(&resp); err != nil {
		return err
	}

	query.Result = &m.UserQuotaDTO{
		Target: query.Target,
		Limit:  quota.Limit,
		UserId: query.UserId,
		Used:   resp[0].Count,
	}

	return nil
}

func GetUserQuotas(query *m.GetUserQuotasQuery) error {
	quotas := make([]*m.Quota, 0)
	sess := x.Table("quota")
	if err := sess.Where("user_id=? AND org_id=0", query.UserId).Find(&quotas); err != nil {
		return err
	}

	defaultQuotas := setting.Quota.User.ToMap()

	seenTargets := make(map[string]bool)
	for _, q := range quotas {
		seenTargets[q.Target] = true
	}

	for t, v := range defaultQuotas {
		if _, ok := seenTargets[t]; !ok {
			quotas = append(quotas, &m.Quota{
				UserId: query.UserId,
				Target: t,
				Limit:  v,
			})
		}
	}

	result := make([]*m.UserQuotaDTO, len(quotas))
	for i, q := range quotas {
		//get quota used.
		rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where user_id=?", dialect.Quote(q.Target))
		resp := make([]*targetCount, 0)
		if err := x.Sql(rawSql, q.UserId).Find(&resp); err != nil {
			return err
		}
		result[i] = &m.UserQuotaDTO{
			Target: q.Target,
			Limit:  q.Limit,
			UserId: q.UserId,
			Used:   resp[0].Count,
		}
	}
	query.Result = result
	return nil
}

func UpdateUserQuota(cmd *m.UpdateUserQuotaCmd) error {
	return inTransaction2(func(sess *session) error {
		//Check if quota is already defined in the DB
		quota := m.Quota{
			Target: cmd.Target,
			UserId: cmd.UserId,
		}
		has, err := sess.Get(&quota)
		if err != nil {
			return err
		}
		quota.Limit = cmd.Limit
		if has == false {
			//No quota in the DB for this target, so create a new one.
			if _, err := sess.Insert(&quota); err != nil {
				return err
			}
		} else {
			//update existing quota entry in the DB.
			if _, err := sess.Id(quota.Id).Update(&quota); err != nil {
				return err
			}
		}

		return nil
	})
}

func GetGlobalQuotaByTarget(query *m.GetGlobalQuotaByTargetQuery) error {
	//get quota used.
	rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s", dialect.Quote(query.Target))
	resp := make([]*targetCount, 0)
	if err := x.Sql(rawSql).Find(&resp); err != nil {
		return err
	}

	query.Result = &m.GlobalQuotaDTO{
		Target: query.Target,
		Limit:  query.Default,
		Used:   resp[0].Count,
	}

	return nil
}
