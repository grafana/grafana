package accesscontrol

// AccessResources contains resources that are used to filter annotations based on RBAC.
type AccessResources struct {
	// Dashboards is a map of dashboard UIDs to IDs for which the user has access to annotations
	Dashboards map[string]int64
	// CanAccessOrgAnnotations true if the user is allowed to access organization annotations
	CanAccessOrgAnnotations bool
	// Skip filtering
	SkipAccessControlFilter bool
}
