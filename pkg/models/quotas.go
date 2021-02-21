package models

import (
	"errors"
	"time"
)

var ErrInvalidQuotaTarget = errors.New("invalid quota target")

type Quota struct {
	Id      int64
	OrgId   int64
	UserId  int64
	Target  string
	Limit   int64
	Created time.Time
	Updated time.Time
}

type QuotaScope struct {
	Name         string
	Target       string
	DefaultLimit int64
}

type OrgQuotaDTO struct {
	OrgId  int64  `json:"org_id"`
	Target string `json:"target"`
	Limit  int64  `json:"limit"`
	Used   int64  `json:"used"`
}

type UserQuotaDTO struct {
	UserId int64  `json:"user_id"`
	Target string `json:"target"`
	Limit  int64  `json:"limit"`
	Used   int64  `json:"used"`
}

type GlobalQuotaDTO struct {
	Target string `json:"target"`
	Limit  int64  `json:"limit"`
	Used   int64  `json:"used"`
}

type GetOrgQuotaByTargetQuery struct {
	Target  string
	OrgId   int64
	Default int64
	Result  *OrgQuotaDTO
}

type GetOrgQuotasQuery struct {
	OrgId  int64
	Result []*OrgQuotaDTO
}

type GetUserQuotaByTargetQuery struct {
	Target  string
	UserId  int64
	Default int64
	Result  *UserQuotaDTO
}

type GetUserQuotasQuery struct {
	UserId int64
	Result []*UserQuotaDTO
}

type GetGlobalQuotaByTargetQuery struct {
	Target  string
	Default int64
	Result  *GlobalQuotaDTO
}

type UpdateOrgQuotaCmd struct {
	Target string `json:"target"`
	Limit  int64  `json:"limit"`
	OrgId  int64  `json:"-"`
}

type UpdateUserQuotaCmd struct {
	Target string `json:"target"`
	Limit  int64  `json:"limit"`
	UserId int64  `json:"-"`
}
