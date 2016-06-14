package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type AlertNotification struct {
	Id       int64
	OrgId    int64
	Name     string
	Type     string
	Settings *simplejson.Json

	Created time.Time
	Updated time.Time
}

type CreateAlertNotificationCommand struct {
	Name     string
	Type     string
	OrgID    int64
	Settings *simplejson.Json

	Result *AlertNotification
}

type UpdateAlertNotificationCommand struct {
	Id       int64
	Name     string
	Type     string
	OrgID    int64
	Settings *simplejson.Json

	Result *AlertNotification
}

type GetAlertNotificationQuery struct {
	Name  string
	ID    int64
	OrgID int64

	Result []*AlertNotification
}
