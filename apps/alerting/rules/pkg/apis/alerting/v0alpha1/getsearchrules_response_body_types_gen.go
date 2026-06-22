// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
)

// RuleHit is the cross-kind union returned by /search.
// +k8s:openapi-gen=true
type GetSearchRulesRuleHit = GetSearchRulesAlertRuleHitOrRecordingRuleHit

// NewGetSearchRulesRuleHit creates a new GetSearchRulesRuleHit object.
func NewGetSearchRulesRuleHit() *GetSearchRulesRuleHit {
	return NewGetSearchRulesAlertRuleHitOrRecordingRuleHit()
}

// +k8s:openapi-gen=true
type GetSearchRulesAlertRuleHit struct {
	Type             GetSearchRulesRuleSearchType `json:"type"`
	Annotations      map[string]string            `json:"annotations,omitempty"`
	For              *string                      `json:"for,omitempty"`
	KeepFiringFor    *string                      `json:"keepFiringFor,omitempty"`
	DashboardUID     *string                      `json:"dashboardUID,omitempty"`
	PanelID          *int64                       `json:"panelID,omitempty"`
	Receiver         *string                      `json:"receiver,omitempty"`
	NotificationType *string                      `json:"notificationType,omitempty"`
	Name             string                       `json:"name"`
	Title            string                       `json:"title"`
	Folder           string                       `json:"folder"`
	Group            *string                      `json:"group,omitempty"`
	Interval         *string                      `json:"interval,omitempty"`
	Paused           *bool                        `json:"paused,omitempty"`
	Labels           map[string]string            `json:"labels,omitempty"`
	RoutingTree      *string                      `json:"routingTree,omitempty"`
	DatasourceUIDs   []string                     `json:"datasourceUIDs,omitempty"`
}

// NewGetSearchRulesAlertRuleHit creates a new GetSearchRulesAlertRuleHit object.
func NewGetSearchRulesAlertRuleHit() *GetSearchRulesAlertRuleHit {
	return &GetSearchRulesAlertRuleHit{
		Type: GetSearchRulesRuleSearchTypeAlertRule,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesAlertRuleHit.
func (GetSearchRulesAlertRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesAlertRuleHit"
}

// +k8s:openapi-gen=true
type GetSearchRulesRuleSearchType string

const (
	GetSearchRulesRuleSearchTypeAlertRule     GetSearchRulesRuleSearchType = "alertrule"
	GetSearchRulesRuleSearchTypeRecordingRule GetSearchRulesRuleSearchType = "recordingrule"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRuleSearchType.
func (GetSearchRulesRuleSearchType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRuleSearchType"
}

// +k8s:openapi-gen=true
type GetSearchRulesRecordingRuleHit struct {
	Type                GetSearchRulesRuleSearchType `json:"type"`
	Metric              *string                      `json:"metric,omitempty"`
	Name                string                       `json:"name"`
	Title               string                       `json:"title"`
	Folder              string                       `json:"folder"`
	Group               *string                      `json:"group,omitempty"`
	Interval            *string                      `json:"interval,omitempty"`
	Paused              *bool                        `json:"paused,omitempty"`
	Labels              map[string]string            `json:"labels,omitempty"`
	TargetDatasourceUID *string                      `json:"targetDatasourceUID,omitempty"`
	DatasourceUIDs      []string                     `json:"datasourceUIDs,omitempty"`
}

// NewGetSearchRulesRecordingRuleHit creates a new GetSearchRulesRecordingRuleHit object.
func NewGetSearchRulesRecordingRuleHit() *GetSearchRulesRecordingRuleHit {
	return &GetSearchRulesRecordingRuleHit{
		Type: GetSearchRulesRuleSearchTypeRecordingRule,
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesRecordingRuleHit.
func (GetSearchRulesRecordingRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesRecordingRuleHit"
}

// FacetResult is the distinct-term breakdown for one faceted field, e.g. the
// per-folder rule counts returned for facet=folder.
// +k8s:openapi-gen=true
type GetSearchRulesFacetResult struct {
	Field   string                    `json:"field"`
	Total   int64                     `json:"total"`
	Missing int64                     `json:"missing"`
	Terms   []GetSearchRulesTermFacet `json:"terms,omitempty"`
}

// NewGetSearchRulesFacetResult creates a new GetSearchRulesFacetResult object.
func NewGetSearchRulesFacetResult() *GetSearchRulesFacetResult {
	return &GetSearchRulesFacetResult{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesFacetResult.
func (GetSearchRulesFacetResult) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesFacetResult"
}

// TermFacet is a single faceted term and the number of matching rules.
// +k8s:openapi-gen=true
type GetSearchRulesTermFacet struct {
	Term  string `json:"term"`
	Count int64  `json:"count"`
}

// NewGetSearchRulesTermFacet creates a new GetSearchRulesTermFacet object.
func NewGetSearchRulesTermFacet() *GetSearchRulesTermFacet {
	return &GetSearchRulesTermFacet{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesTermFacet.
func (GetSearchRulesTermFacet) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesTermFacet"
}

// +k8s:openapi-gen=true
type GetSearchRulesBody struct {
	Items  []GetSearchRulesRuleHit              `json:"items"`
	Facets map[string]GetSearchRulesFacetResult `json:"facets,omitempty"`
}

// NewGetSearchRulesBody creates a new GetSearchRulesBody object.
func NewGetSearchRulesBody() *GetSearchRulesBody {
	return &GetSearchRulesBody{
		Items: []GetSearchRulesRuleHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesBody.
func (GetSearchRulesBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesBody"
}

// +k8s:openapi-gen=true
type GetSearchRulesAlertRuleHitOrRecordingRuleHit struct {
	AlertRuleHit     *GetSearchRulesAlertRuleHit     `json:"AlertRuleHit,omitempty"`
	RecordingRuleHit *GetSearchRulesRecordingRuleHit `json:"RecordingRuleHit,omitempty"`
}

// NewGetSearchRulesAlertRuleHitOrRecordingRuleHit creates a new GetSearchRulesAlertRuleHitOrRecordingRuleHit object.
func NewGetSearchRulesAlertRuleHitOrRecordingRuleHit() *GetSearchRulesAlertRuleHitOrRecordingRuleHit {
	return &GetSearchRulesAlertRuleHitOrRecordingRuleHit{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `GetSearchRulesAlertRuleHitOrRecordingRuleHit` as JSON.
func (resource GetSearchRulesAlertRuleHitOrRecordingRuleHit) MarshalJSON() ([]byte, error) {
	if resource.AlertRuleHit != nil {
		return json.Marshal(resource.AlertRuleHit)
	}
	if resource.RecordingRuleHit != nil {
		return json.Marshal(resource.RecordingRuleHit)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `GetSearchRulesAlertRuleHitOrRecordingRuleHit` from JSON.
func (resource *GetSearchRulesAlertRuleHitOrRecordingRuleHit) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["type"]
	if !found {
		return nil
	}

	switch discriminator {
	case "alertrule":
		var getSearchRulesAlertRuleHit GetSearchRulesAlertRuleHit
		if err := json.Unmarshal(raw, &getSearchRulesAlertRuleHit); err != nil {
			return err
		}

		resource.AlertRuleHit = &getSearchRulesAlertRuleHit
		return nil
	case "recordingrule":
		var getSearchRulesRecordingRuleHit GetSearchRulesRecordingRuleHit
		if err := json.Unmarshal(raw, &getSearchRulesRecordingRuleHit); err != nil {
			return err
		}

		resource.RecordingRuleHit = &getSearchRulesRecordingRuleHit
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRulesAlertRuleHitOrRecordingRuleHit.
func (GetSearchRulesAlertRuleHitOrRecordingRuleHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.GetSearchRulesAlertRuleHitOrRecordingRuleHit"
}
