package resource

// customPrunerHistoryLimits defines resource-specific history limits.
// The key format is "group/resource".
var customPrunerHistoryLimits = map[string]int{
	"plugins.grafana.app/plugins": 3,
}

// LookupCustomPrunerHistoryLimit returns a resource-specific history limit when one is configured.
func LookupCustomPrunerHistoryLimit(group, resource string) (int, bool) {
	limit, ok := customPrunerHistoryLimits[group+"/"+resource]
	return limit, ok
}
