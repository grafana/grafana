// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetSearchAlertRulesRequestRuleSearchSortField string

const (
	GetSearchAlertRulesRequestRuleSearchSortFieldTitleAsc  GetSearchAlertRulesRequestRuleSearchSortField = "title"
	GetSearchAlertRulesRequestRuleSearchSortFieldTitleDesc GetSearchAlertRulesRequestRuleSearchSortField = "-title"
	GetSearchAlertRulesRequestRuleSearchSortFieldGroupAsc  GetSearchAlertRulesRequestRuleSearchSortField = "group"
	GetSearchAlertRulesRequestRuleSearchSortFieldGroupDesc GetSearchAlertRulesRequestRuleSearchSortField = "-group"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesRequestRuleSearchSortField.
func (GetSearchAlertRulesRequestRuleSearchSortField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesRequestRuleSearchSortField"
}

type GetSearchAlertRulesRequestParams struct {
	DashboardUID     *string                                        `json:"dashboardUID,omitempty"`
	PanelID          *int64                                         `json:"panelID,omitempty"`
	Receiver         *string                                        `json:"receiver,omitempty"`
	NotificationType *string                                        `json:"notificationType,omitempty"`
	Q                *string                                        `json:"q,omitempty"`
	Names            []string                                       `json:"names,omitempty"`
	Folders          []string                                       `json:"folders,omitempty"`
	Groups           []string                                       `json:"groups,omitempty"`
	Paused           *bool                                          `json:"paused,omitempty"`
	DatasourceUIDs   []string                                       `json:"datasourceUIDs,omitempty"`
	Labels           []string                                       `json:"labels,omitempty"`
	Limit            *int64                                         `json:"limit,omitempty"`
	RoutingTree      *string                                        `json:"routingTree,omitempty"`
	Sort             *GetSearchAlertRulesRequestRuleSearchSortField `json:"sort,omitempty"`
	ContinueToken    *string                                        `json:"continueToken,omitempty"`
}

// NewGetSearchAlertRulesRequestParams creates a new GetSearchAlertRulesRequestParams object.
func NewGetSearchAlertRulesRequestParams() *GetSearchAlertRulesRequestParams {
	return &GetSearchAlertRulesRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchAlertRulesRequestParams.
func (GetSearchAlertRulesRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchAlertRulesRequestParams"
}
