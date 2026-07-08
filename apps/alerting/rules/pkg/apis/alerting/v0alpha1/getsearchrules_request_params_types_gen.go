// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetSearchRulesRequestRuleSearchSortField string

const (
	GetSearchRulesRequestRuleSearchSortFieldTitleAsc     GetSearchRulesRequestRuleSearchSortField = "title"
	GetSearchRulesRequestRuleSearchSortFieldTitleDesc    GetSearchRulesRequestRuleSearchSortField = "-title"
	GetSearchRulesRequestRuleSearchSortFieldSequenceAsc  GetSearchRulesRequestRuleSearchSortField = "sequence"
	GetSearchRulesRequestRuleSearchSortFieldSequenceDesc GetSearchRulesRequestRuleSearchSortField = "-sequence"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRequestRuleSearchSortField.
func (GetSearchRulesRequestRuleSearchSortField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRequestRuleSearchSortField"
}

type GetSearchRulesRequestParams struct {
	Type                *string                                   `json:"type,omitempty"`
	DashboardUID        *string                                   `json:"dashboardUID,omitempty"`
	PanelID             *int64                                    `json:"panelID,omitempty"`
	Receiver            *string                                   `json:"receiver,omitempty"`
	NotificationType    *string                                   `json:"notificationType,omitempty"`
	Q                   *string                                   `json:"q,omitempty"`
	Limit               *int64                                    `json:"limit,omitempty"`
	Metric              *string                                   `json:"metric,omitempty"`
	Names               []string                                  `json:"names,omitempty"`
	Folders             []string                                  `json:"folders,omitempty"`
	Sequences           []string                                  `json:"sequences,omitempty"`
	Paused              *bool                                     `json:"paused,omitempty"`
	DatasourceUIDs      []string                                  `json:"datasourceUIDs,omitempty"`
	Labels              []string                                  `json:"labels,omitempty"`
	RoutingTree         *string                                   `json:"routingTree,omitempty"`
	Sort                *GetSearchRulesRequestRuleSearchSortField `json:"sort,omitempty"`
	ContinueToken       *string                                   `json:"continueToken,omitempty"`
	TargetDatasourceUID *string                                   `json:"targetDatasourceUID,omitempty"`
}

// NewGetSearchRulesRequestParams creates a new GetSearchRulesRequestParams object.
func NewGetSearchRulesRequestParams() *GetSearchRulesRequestParams {
	return &GetSearchRulesRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRequestParams.
func (GetSearchRulesRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRequestParams"
}
