package accesscontrol

// AccessResources contains resources that are used to filter annotations based on RBAC.
type AccessResources struct {
	// Dashboards is a map of dashboard UIDs to IDs
	Dashboards map[string]int64
	// CanAccessDashAnnotations true if the user is allowed to access some dashboard annotations
	CanAccessDashAnnotations bool
	// CanAccessOrgAnnotations true if the user is allowed to access organization annotations
	CanAccessOrgAnnotations bool
	// Skip filtering
	SkipAccessControlFilter bool
}
