package models

import (
	"errors"
	"github.com/grafana/grafana/pkg/setting"
	"time"
)

type QuotaTarget string

const (
	QUOTA_USER       QuotaTarget = "user" //SQL table to query. ie. "select count(*) from user where org_id=?"
	QUOTA_DATASOURCE QuotaTarget = "data_source"
	QUOTA_DASHBOARD  QuotaTarget = "dashboard"
)

var ErrInvalidQuotaTarget = errors.New("Invalid quota target")

func (q QuotaTarget) IsValid() bool {
	_, ok := setting.Quota.Default[string(q)]
	return ok
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
