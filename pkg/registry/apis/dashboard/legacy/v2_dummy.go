package legacy

import (
	"time"

	dashboardv2alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
)

func newDummyDashboard(uid string) map[string]any {
	var staticWarningPanel = map[string]interface{}{
		"gridPos": map[string]interface{}{
			"h": 13,
			"w": 24, // full width
			"x": 0,
			"y": 0,
		},
		"options": map[string]interface{}{
			"mode": "html",
			"content": `<div style="background:#eb4438; color:#000; padding:50px; height:1000px;">
			<h1>This dashboard was saved using schema v2 🎉🎉🎉🎉🎉🎉<h1>
			<br/>
			<h1>It is not possible to load v2 dashboards from the SQL database<h1>
		</div>`,
		},
		"transparent": true,
		"type":        "text",
	}
	return map[string]any{
		"schemaVersion": dashboardv2alpha1.PLACEHOLDER_DASHBOARD_SCHEMA_VERSION, // no more schemaVersion in v2!
		"title":         "v2alpha1 dashboard " + time.Now().Format(time.DateOnly),
		"uid":           uid,
		"panels":        []any{staticWarningPanel},
	}
}
