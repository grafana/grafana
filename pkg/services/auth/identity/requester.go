package identity

type Requester interface {
	GetIsGrafanaAdmin() bool
	GetLogin() string
	GetOrgID() int64
	GetPermissions(orgID int64) map[string][]string
	IsNil() bool
}
