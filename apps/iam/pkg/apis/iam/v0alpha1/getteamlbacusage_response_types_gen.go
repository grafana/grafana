// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTeamLBACUsageResponse struct {
	Counts map[string]GetTeamLBACUsageV0alpha1ResponseCounts `json:"counts"`
}

// NewGetTeamLBACUsageResponse creates a new GetTeamLBACUsageResponse object.
func NewGetTeamLBACUsageResponse() *GetTeamLBACUsageResponse {
	return &GetTeamLBACUsageResponse{
		Counts: map[string]GetTeamLBACUsageV0alpha1ResponseCounts{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetTeamLBACUsageResponse.
func (GetTeamLBACUsageResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamLBACUsageResponse"
}

// +k8s:openapi-gen=true
type GetTeamLBACUsageV0alpha1ResponseCounts struct {
	Datasources int64 `json:"datasources"`
	Teams       int64 `json:"teams"`
	Filters     int64 `json:"filters"`
}

// NewGetTeamLBACUsageV0alpha1ResponseCounts creates a new GetTeamLBACUsageV0alpha1ResponseCounts object.
func NewGetTeamLBACUsageV0alpha1ResponseCounts() *GetTeamLBACUsageV0alpha1ResponseCounts {
	return &GetTeamLBACUsageV0alpha1ResponseCounts{}
}

// OpenAPIModelName returns the OpenAPI model name for GetTeamLBACUsageV0alpha1ResponseCounts.
func (GetTeamLBACUsageV0alpha1ResponseCounts) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamLBACUsageV0alpha1ResponseCounts"
}
