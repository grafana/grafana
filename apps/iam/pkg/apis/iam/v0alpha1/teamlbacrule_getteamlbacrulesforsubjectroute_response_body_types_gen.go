// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTeamLBACRulesForSubjectRouteBody struct {
	TeamFilters map[string][]string `json:"team_filters"`
}

// NewGetTeamLBACRulesForSubjectRouteBody creates a new GetTeamLBACRulesForSubjectRouteBody object.
func NewGetTeamLBACRulesForSubjectRouteBody() *GetTeamLBACRulesForSubjectRouteBody {
	return &GetTeamLBACRulesForSubjectRouteBody{
		TeamFilters: map[string][]string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetTeamLBACRulesForSubjectRouteBody.
func (GetTeamLBACRulesForSubjectRouteBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetTeamLBACRulesForSubjectRouteBody"
}
