// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserTeamSyncStatus struct {
	State      UserTeamSyncStatusState `json:"state"`
	LastSyncAt int64                   `json:"lastSyncAt"`
}

// NewUserTeamSyncStatus creates a new UserTeamSyncStatus object.
func NewUserTeamSyncStatus() *UserTeamSyncStatus {
	return &UserTeamSyncStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for UserTeamSyncStatus.
func (UserTeamSyncStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.UserTeamSyncStatus"
}

// +k8s:openapi-gen=true
type UserStatus struct {
	LastSeenAt int64               `json:"lastSeenAt"`
	TeamSync   *UserTeamSyncStatus `json:"teamSync,omitempty"`
}

// NewUserStatus creates a new UserStatus object.
func NewUserStatus() *UserStatus {
	return &UserStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for UserStatus.
func (UserStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.UserStatus"
}

// +k8s:openapi-gen=true
type UserTeamSyncStatusState string

const (
	UserTeamSyncStatusStateSyncing UserTeamSyncStatusState = "syncing"
	UserTeamSyncStatusStateSuccess UserTeamSyncStatusState = "success"
	UserTeamSyncStatusStateError   UserTeamSyncStatusState = "error"
)

// OpenAPIModelName returns the OpenAPI model name for UserTeamSyncStatusState.
func (UserTeamSyncStatusState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.UserTeamSyncStatusState"
}
