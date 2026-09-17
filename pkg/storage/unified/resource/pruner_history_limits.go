package resource

// defaultPrunerHistoryLimit is the default number of history entries to keep per resource.
const defaultPrunerHistoryLimit = 20

// customPrunerHistoryLimits defines resource-specific history limits.
// The key format is "group/resource".
var customPrunerHistoryLimits = map[string]int{
	"plugins.grafana.app/plugins": 3,
	// Jobs are ephemeral work items, but retaining a few revisions keeps recent
	// predecessors available to watches. HistoricJobs are terminal audit records
	// and do not benefit from a version trail.
	"provisioning.grafana.app/jobs":         3,
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
