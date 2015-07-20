package models

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/setting"
	"time"
)

type QuotaTarget string

const (
	QUOTA_USER       QuotaTarget = "user" //SQL table to query. ie. "select count(*) from user where org_id=?"
	QUOTA_DATASOURCE QuotaTarget = "data_source"
	QUOTA_DASHBOARD  QuotaTarget = "dashboard"
	QUOTA_ENDPOINT   QuotaTarget = "endpoint"
	QUOTA_COLLECTOR  QuotaTarget = "collector"
)

// defaults are set from settings package.
var DefaultQuotas map[QuotaTarget]int64

func InitQuotaDefaults() {
	// set global defaults.
	DefaultQuotas = make(map[QuotaTarget]int64)
	quota := setting.Cfg.Section("quota")
	DefaultQuotas[QUOTA_USER] = quota.Key("user").MustInt64(10)
	DefaultQuotas[QUOTA_DATASOURCE] = quota.Key("data_source").MustInt64(10)
	DefaultQuotas[QUOTA_DASHBOARD] = quota.Key("dashboard").MustInt64(10)
	DefaultQuotas[QUOTA_ENDPOINT] = quota.Key("endpoint").MustInt64(10)
	DefaultQuotas[QUOTA_COLLECTOR] = quota.Key("collector").MustInt64(10)
}

type Quota struct {
	Id      int64
	OrgId   int64
	Target  QuotaTarget
	Limit   int64
	Created time.Time
	Updated time.Time
}

type QuotaDTO struct {
	OrgId  int64       `json:"org_id"`
	Target QuotaTarget `json:"target"`
	Limit  int64       `json:"limit"`
	Used   int64       `json:"used"`
}

type GetQuotaByTargetQuery struct {
	Target QuotaTarget
	OrgId  int64
	Result *QuotaDTO
}

type GetQuotasQuery struct {
	OrgId  int64
	Result []*QuotaDTO
}

type UpdateQuotaCmd struct {
	Target QuotaTarget `json:"target"`
	Limit  int64       `json:"limit"`
	OrgId  int64       `json:"-"`
}

func QuotaReached(org_id int64, target QuotaTarget) (bool, error) {
	query := GetQuotaByTargetQuery{OrgId: org_id, Target: target}
	if err := bus.Dispatch(&query); err != nil {
		return true, err
	}
	if query.Result.Used >= query.Result.Limit {
		return true, nil
	}
	return false, nil
}
