// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetSearchRecordingRulesRequestRuleSearchSortField string

const (
	GetSearchRecordingRulesRequestRuleSearchSortFieldTitleAsc  GetSearchRecordingRulesRequestRuleSearchSortField = "title"
	GetSearchRecordingRulesRequestRuleSearchSortFieldTitleDesc GetSearchRecordingRulesRequestRuleSearchSortField = "-title"
	GetSearchRecordingRulesRequestRuleSearchSortFieldGroupAsc  GetSearchRecordingRulesRequestRuleSearchSortField = "group"
	GetSearchRecordingRulesRequestRuleSearchSortFieldGroupDesc GetSearchRecordingRulesRequestRuleSearchSortField = "-group"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesRequestRuleSearchSortField.
func (GetSearchRecordingRulesRequestRuleSearchSortField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesRequestRuleSearchSortField"
}

type GetSearchRecordingRulesRequestParams struct {
	Metric              *string                                            `json:"metric,omitempty"`
	Q                   *string                                            `json:"q,omitempty"`
	Folders             []string                                           `json:"folders,omitempty"`
	Groups              []string                                           `json:"groups,omitempty"`
	Paused              *bool                                              `json:"paused,omitempty"`
	DatasourceUIDs      []string                                           `json:"datasourceUIDs,omitempty"`
	Labels              []string                                           `json:"labels,omitempty"`
	Limit               *int64                                             `json:"limit,omitempty"`
	TargetDatasourceUID *string                                            `json:"targetDatasourceUID,omitempty"`
	Sort                *GetSearchRecordingRulesRequestRuleSearchSortField `json:"sort,omitempty"`
	ContinueToken       *string                                            `json:"continueToken,omitempty"`
}

// NewGetSearchRecordingRulesRequestParams creates a new GetSearchRecordingRulesRequestParams object.
func NewGetSearchRecordingRulesRequestParams() *GetSearchRecordingRulesRequestParams {
	return &GetSearchRecordingRulesRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRecordingRulesRequestParams.
func (GetSearchRecordingRulesRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRecordingRulesRequestParams"
}
