// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetSearchRulesRequestRuleSearchSortField string

const (
	GetSearchRulesRequestRuleSearchSortFieldTitleAsc  GetSearchRulesRequestRuleSearchSortField = "title"
	GetSearchRulesRequestRuleSearchSortFieldTitleDesc GetSearchRulesRequestRuleSearchSortField = "-title"
	GetSearchRulesRequestRuleSearchSortFieldGroupAsc  GetSearchRulesRequestRuleSearchSortField = "group"
	GetSearchRulesRequestRuleSearchSortFieldGroupDesc GetSearchRulesRequestRuleSearchSortField = "-group"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRequestRuleSearchSortField.
func (GetSearchRulesRequestRuleSearchSortField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRequestRuleSearchSortField"
}

type GetSearchRulesRequestParams struct {
	Type             *string                                   `json:"type,omitempty"`
	DashboardUID     *string                                   `json:"dashboardUID,omitempty"`
	PanelID          *int64                                    `json:"panelID,omitempty"`
	Receiver         *string                                   `json:"receiver,omitempty"`
	NotificationType *string                                   `json:"notificationType,omitempty"`
	Q                *string                                   `json:"q,omitempty"`
	Limit            *int64                                    `json:"limit,omitempty"`
	Metric           *string                                   `json:"metric,omitempty"`
	Names            []string                                  `json:"names,omitempty"`
	Folders          []string                                  `json:"folders,omitempty"`
	Groups           []string                                  `json:"groups,omitempty"`
	Paused           *bool                                     `json:"paused,omitempty"`
	DatasourceUIDs   []string                                  `json:"datasourceUIDs,omitempty"`
	Labels           []string                                  `json:"labels,omitempty"`
	Sort             *GetSearchRulesRequestRuleSearchSortField `json:"sort,omitempty"`
	// Fields to count distinct terms for (e.g. "folder"). Returned under
	// "facets" keyed by field name. Facet terms are ordered by count, not
	// alphabetically.
	Facet       []string `json:"facet,omitempty"`
	RoutingTree *string  `json:"routingTree,omitempty"`
	// Max terms returned per facet (default 50, max 1000).
	FacetLimit          *int64  `json:"facetLimit,omitempty"`
	ContinueToken       *string `json:"continueToken,omitempty"`
	TargetDatasourceUID *string `json:"targetDatasourceUID,omitempty"`
}

// NewGetSearchRulesRequestParams creates a new GetSearchRulesRequestParams object.
func NewGetSearchRulesRequestParams() *GetSearchRulesRequestParams {
	return &GetSearchRulesRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRequestParams.
func (GetSearchRulesRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRequestParams"
}
