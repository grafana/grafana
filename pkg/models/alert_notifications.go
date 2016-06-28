package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type AlertNotification struct {
	Id            int64            `json:"id"`
	OrgId         int64            `json:"-"`
	Name          string           `json:"name"`
	Type          string           `json:"type"`
	AlwaysExecute bool             `json:"alwaysExecute"`
	Settings      *simplejson.Json `json:"settings"`
	Created       time.Time        `json:"created"`
	Updated       time.Time        `json:"updated"`
}

type CreateAlertNotificationCommand struct {
	Name          string           `json:"name"  binding:"Required"`
	Type          string           `json:"type"  binding:"Required"`
	AlwaysExecute bool             `json:"alwaysExecute"`
	OrgID         int64            `json:"-"`
	Settings      *simplejson.Json `json:"settings"`

	Result *AlertNotification
}

type UpdateAlertNotificationCommand struct {
	Id            int64            `json:"id"  binding:"Required"`
	Name          string           `json:"name"  binding:"Required"`
	Type          string           `json:"type"  binding:"Required"`
	AlwaysExecute bool             `json:"alwaysExecute"`
	OrgID         int64            `json:"-"`
	Settings      *simplejson.Json `json:"settings"  binding:"Required"`

	Result *AlertNotification
}

type DeleteAlertNotificationCommand struct {
	Id    int64
	OrgId int64
}

type GetAlertNotificationQuery struct {
	Name                 string
	Id                   int64
	Ids                  []int64
	OrgID                int64
	IncludeAlwaysExecute bool

	Result []*AlertNotification
}
