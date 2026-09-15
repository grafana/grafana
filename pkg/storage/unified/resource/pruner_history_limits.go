package resource

// defaultPrunerHistoryLimit is the default number of history entries to keep per resource.
const defaultPrunerHistoryLimit = 20

// customPrunerHistoryLimits defines resource-specific history limits.
// The key format is "group/resource".
var customPrunerHistoryLimits = map[string]int{
	"plugins.grafana.app/plugins": 3,
	// Jobs are ephemeral work items and HistoricJobs are terminal audit
	// records; neither benefits from a version trail, so keep only the latest.
	"provisioning.grafana.app/jobs":         1,
	"provisioning.grafana.app/historicjobs": 1,
}

// LookupPrunerHistoryLimit returns the history limit for the given group/resource,
// honouring the dashboardVersionsToKeep configuration setting.
func LookupPrunerHistoryLimit(group, resource string, dashboardVersionsToKeep int) int {
	if group == "dashboard.grafana.app" && resource == "dashboards" {
		return max(dashboardVersionsToKeep, 1)
	}
	if limit, ok := customPrunerHistoryLimits[group+"/"+resource]; ok {
		return limit
	}
	return defaultPrunerHistoryLimit
}
