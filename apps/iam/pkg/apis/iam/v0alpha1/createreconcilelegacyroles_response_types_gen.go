// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Counts for an internal reconciliation operation; absent roles are reported only.
// +k8s:openapi-gen=true
type CreateReconcileLegacyRolesLegacyRoleReconcileCounts struct {
	Created int64 `json:"created"`
	Updated int64 `json:"updated"`
	// Stored roles absent from GlobalRoles. Reported only; never deleted.
	WouldDelete []string `json:"wouldDelete"`
}

// NewCreateReconcileLegacyRolesLegacyRoleReconcileCounts creates a new CreateReconcileLegacyRolesLegacyRoleReconcileCounts object.
func NewCreateReconcileLegacyRolesLegacyRoleReconcileCounts() *CreateReconcileLegacyRolesLegacyRoleReconcileCounts {
	return &CreateReconcileLegacyRolesLegacyRoleReconcileCounts{
		WouldDelete: []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateReconcileLegacyRolesLegacyRoleReconcileCounts.
func (CreateReconcileLegacyRolesLegacyRoleReconcileCounts) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateReconcileLegacyRolesLegacyRoleReconcileCounts"
}

// Internal only; not for use by end-users.
// +k8s:openapi-gen=true
type CreateReconcileLegacyRolesResponse struct {
	// True when no roles needed creating or updating; absent roles do not affect this.
	InSync      bool                                                `json:"inSync"`
	FixedRoles  CreateReconcileLegacyRolesLegacyRoleReconcileCounts `json:"fixedRoles"`
	PluginRoles CreateReconcileLegacyRolesLegacyRoleReconcileCounts `json:"pluginRoles"`
	DurationMs  int64                                               `json:"durationMs"`
}

// NewCreateReconcileLegacyRolesResponse creates a new CreateReconcileLegacyRolesResponse object.
func NewCreateReconcileLegacyRolesResponse() *CreateReconcileLegacyRolesResponse {
	return &CreateReconcileLegacyRolesResponse{
		FixedRoles:  *NewCreateReconcileLegacyRolesLegacyRoleReconcileCounts(),
		PluginRoles: *NewCreateReconcileLegacyRolesLegacyRoleReconcileCounts(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateReconcileLegacyRolesResponse.
func (CreateReconcileLegacyRolesResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateReconcileLegacyRolesResponse"
}
