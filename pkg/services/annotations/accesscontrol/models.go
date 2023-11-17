package accesscontrol

// AccessResources contains resources that are used to filter annotations based on RBAC.
type AccessResources struct {
	// Dashboards is a map of dashboard UIDs to IDs
	Dashboards map[string]int64
	// ScopeTypes contains the scope types that the user has access to. At most `dashboard` and `organization`
	ScopeTypes map[any]struct{}
}

type dashboardProjection struct {
	ID  int64  `xorm:"id"`
	UID string `xorm:"uid"`
}
