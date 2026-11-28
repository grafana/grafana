package dtos

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	legacydashboards "github.com/grafana/grafana/pkg/legacyapi/dashboards"
)

type DashboardMeta = legacydashboards.DashboardMeta

type DashboardFullWithMeta struct {
	Meta      DashboardMeta    `json:"meta"`
	Dashboard *simplejson.Json `json:"dashboard"`
}

type DashboardRedirect struct {
	RedirectUri string `json:"redirectUri"`
}

type CalculateDiffOptions struct {
	Base     CalculateDiffTarget `json:"base" binding:"Required"`
	New      CalculateDiffTarget `json:"new" binding:"Required"`
	DiffType string              `json:"diffType" binding:"Required"`
}

type CalculateDiffTarget struct {
	DashboardId      int64            `json:"dashboardId"`
	Version          int64            `json:"version"`
	UnsavedDashboard *simplejson.Json `json:"unsavedDashboard"`
}

type RestoreDashboardVersionCommand struct {
	Version int64 `json:"version" binding:"Required"`
}
