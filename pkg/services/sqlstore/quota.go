package sqlstore

import (
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	bus.AddHandler("sql", GetOrgQuotaByTarget)
	bus.AddHandler("sql", GetOrgQuotas)
	bus.AddHandler("sql", UpdateOrgQuota)
	bus.AddHandler("sql", GetUserQuotaByTarget)
	bus.AddHandler("sql", GetUserQuotas)
	bus.AddHandler("sql", UpdateUserQuota)
	bus.AddHandler("sql", GetGlobalQuotaByTarget)
=======
)

func init() {
	bus.AddHandler("sql", GetQuotaByTarget)
	bus.AddHandler("sql", GetQuotas)
	bus.AddHandler("sql", UpdateQuota)
>>>>>>> inital backend suport for quotas. issue #321
}

type targetCount struct {
	Count int64
}

<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
func GetOrgQuotaByTarget(query *m.GetOrgQuotaByTargetQuery) error {
=======
func GetQuotaByTarget(query *m.GetQuotaByTargetQuery) error {
>>>>>>> inital backend suport for quotas. issue #321
	quota := m.Quota{
		Target: query.Target,
		OrgId:  query.OrgId,
	}
<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
	has, err := x.Get(&quota)
	if err != nil {
		return err
	} else if has == false {
		quota.Limit = query.Default
	}

	//get quota used.
	rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where org_id=?", dialect.Quote(query.Target))
=======
	has, err := x.Get(quota)
	if err != nil {
		return err
	} else if has == false {
		quota.Limit = m.DefaultQuotas[query.Target]
	}

	//get quota used.
	rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where org_id=?", string(query.Target))
>>>>>>> inital backend suport for quotas. issue #321
	resp := make([]*targetCount, 0)
	if err := x.Sql(rawSql, query.OrgId).Find(&resp); err != nil {
		return err
	}

<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
	query.Result = &m.OrgQuotaDTO{
=======
	query.Result = &m.QuotaDTO{
>>>>>>> inital backend suport for quotas. issue #321
		Target: query.Target,
		Limit:  quota.Limit,
		OrgId:  query.OrgId,
		Used:   resp[0].Count,
	}

	return nil
}

<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
func GetOrgQuotas(query *m.GetOrgQuotasQuery) error {
	quotas := make([]*m.Quota, 0)
	sess := x.Table("quota")
	if err := sess.Where("org_id=? AND user_id=0", query.OrgId).Find(&quotas); err != nil {
		return err
	}

	defaultQuotas := setting.Quota.Org.ToMap()

	seenTargets := make(map[string]bool)
=======
func GetQuotas(query *m.GetQuotasQuery) error {
	quotas := make([]*m.Quota, 0)
	sess := x.Table("quota")
	if err := sess.Where("org_id=?", query.OrgId).Find(&quotas); err != nil {
		return err
	}

	seenTargets := make(map[m.QuotaTarget]bool)
>>>>>>> inital backend suport for quotas. issue #321
	for _, q := range quotas {
		seenTargets[q.Target] = true
	}

<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
	for t, v := range defaultQuotas {
=======
	for t, v := range m.DefaultQuotas {
>>>>>>> inital backend suport for quotas. issue #321
		if _, ok := seenTargets[t]; !ok {
			quotas = append(quotas, &m.Quota{
				OrgId:  query.OrgId,
				Target: t,
				Limit:  v,
			})
		}
	}
<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f

	result := make([]*m.OrgQuotaDTO, len(quotas))
	for i, q := range quotas {
		//get quota used.
		rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where org_id=?", dialect.Quote(q.Target))
=======
	result := make([]*m.QuotaDTO, len(quotas))
	for i, q := range quotas {
		//get quota used.
		rawSql := fmt.Sprintf("SELECT COUNT(*) as count from %s where org_id=?", string(q.Target))
>>>>>>> inital backend suport for quotas. issue #321
		resp := make([]*targetCount, 0)
		if err := x.Sql(rawSql, q.OrgId).Find(&resp); err != nil {
			return err
		}
<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
		result[i] = &m.OrgQuotaDTO{
=======
		result[i] = &m.QuotaDTO{
>>>>>>> inital backend suport for quotas. issue #321
			Target: q.Target,
			Limit:  q.Limit,
			OrgId:  q.OrgId,
			Used:   resp[0].Count,
		}
	}
	query.Result = result
	return nil
}

<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
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

=======
func UpdateQuota(cmd *m.UpdateQuotaCmd) error {
>>>>>>> inital backend suport for quotas. issue #321
	return nil
}
