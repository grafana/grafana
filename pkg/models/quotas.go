package models

import (
<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
	"errors"
=======
>>>>>>> inital backend suport for quotas. issue #321
	"github.com/grafana/grafana/pkg/setting"
	"time"
)

<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
var ErrInvalidQuotaTarget = errors.New("Invalid quota target")
=======
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
>>>>>>> inital backend suport for quotas. issue #321

type Quota struct {
	Id      int64
	OrgId   int64
<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
	UserId  int64
	Target  string
=======
	Target  QuotaTarget
>>>>>>> inital backend suport for quotas. issue #321
	Limit   int64
	Created time.Time
	Updated time.Time
}

<<<<<<< a45fe092e3c019f7fa28ff8a075cba3eccc0f82f
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

func GetQuotaScopes(target string) ([]QuotaScope, error) {
	scopes := make([]QuotaScope, 0)
	switch target {
	case "user":
		scopes = append(scopes,
			QuotaScope{Name: "global", Target: target, DefaultLimit: setting.Quota.Global.User},
			QuotaScope{Name: "org", Target: "org_user", DefaultLimit: setting.Quota.Org.User},
		)
		return scopes, nil
	case "org":
		scopes = append(scopes,
			QuotaScope{Name: "global", Target: target, DefaultLimit: setting.Quota.Global.Org},
			QuotaScope{Name: "user", Target: "org_user", DefaultLimit: setting.Quota.User.Org},
		)
		return scopes, nil
	case "dashboard":
		scopes = append(scopes,
			QuotaScope{Name: "global", Target: target, DefaultLimit: setting.Quota.Global.Dashboard},
			QuotaScope{Name: "org", Target: target, DefaultLimit: setting.Quota.Org.Dashboard},
		)
		return scopes, nil
	case "data_source":
		scopes = append(scopes,
			QuotaScope{Name: "global", Target: target, DefaultLimit: setting.Quota.Global.DataSource},
			QuotaScope{Name: "org", Target: target, DefaultLimit: setting.Quota.Org.DataSource},
		)
		return scopes, nil
	case "api_key":
		scopes = append(scopes,
			QuotaScope{Name: "global", Target: target, DefaultLimit: setting.Quota.Global.ApiKey},
			QuotaScope{Name: "org", Target: target, DefaultLimit: setting.Quota.Org.ApiKey},
		)
		return scopes, nil
	case "session":
		scopes = append(scopes,
			QuotaScope{Name: "global", Target: target, DefaultLimit: setting.Quota.Global.Session},
		)
		return scopes, nil
	default:
		return scopes, ErrInvalidQuotaTarget
	}
=======
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
>>>>>>> inital backend suport for quotas. issue #321
}
