package models

import "github.com/grafana/grafana/pkg/components/simplejson"

type CustomDashPersonalization struct {
	ID   int64            `xorm:"id" json:"id"`
	Data *simplejson.Json `xorm:"data" json:"data"`
}

type GetCustomDashPersonalization struct {
	OrgID   int64
	UserID  int64
	DashUID string
	Result  *CustomDashPersonalization
}

type DeleteCustomDashPersonalization struct {
	OrgID   int64
	UserID  int64
	DashUID string
}

type SaveCustomDashPersonalization struct {
	ID      int64            `xorm:"extends" json:"-"`
	Data    *simplejson.Json `xorm:"data" json:"data"`
	OrgID   int64            `xorm:"org_id"`
	UserID  int64            `xorm:"user_id"`
	DashUID string           `xorm:"dash_uid"`
}
