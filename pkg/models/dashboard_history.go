package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

// Dashboard history model
type DashboardHistory struct {
	Id               int64
	DashboardId      int64
	DashboardVersion int
	Updated          time.Time
	UpdatedBy        int64
	Data             *simplejson.Json
}

type GetDashboardHistoryQuery struct {
	Id int64
	Result []*DashboardHistory
}
