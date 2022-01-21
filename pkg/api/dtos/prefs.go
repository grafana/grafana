package dtos

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

type Prefs struct {
	Theme            string           `json:"theme"`
	HomeDashboardID  int64            `json:"homeDashboardId"`
	Timezone         string           `json:"timezone"`
	WeekStart        string           `json:"weekStart"`
	QueryHistoryJSON *simplejson.Json `json:"queryHistoryJson"`
}

type UpdatePrefsCmd struct {
	Theme            string           `json:"theme"`
	HomeDashboardID  int64            `json:"homeDashboardId"`
	Timezone         string           `json:"timezone"`
	WeekStart        string           `json:"weekStart"`
	QueryHistoryJSON *simplejson.Json `json:"queryHistoryJson"`
}
