package accesscontrol

// AccessResources is a struct that contains resources that are used to check access to annotations.
type AccessResources struct {
	// Dashboards is a map of dashboard UIDs to IDs
	Dashboards map[string]int64
	// ScopeTypes are parsed scopes, filtered to at most `dashboard` and `organization`
	ScopeTypes map[any]struct{}
}

type dashboardProjection struct {
	ID  int64  `xorm:"id"`
	UID string `xorm:"uid"`
}
