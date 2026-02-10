// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type CreateCheckBody struct {
	CompatibilityScore float64                                    `json:"compatibilityScore"`
	DatasourceResults  []CreateCheckV1alpha1BodyDatasourceResults `json:"datasourceResults"`
}

// NewCreateCheckBody creates a new CreateCheckBody object.
func NewCreateCheckBody() *CreateCheckBody {
	return &CreateCheckBody{
		DatasourceResults: []CreateCheckV1alpha1BodyDatasourceResults{},
	}
}

// +k8s:openapi-gen=true
type CreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown struct {
	PanelTitle         string   `json:"panelTitle"`
	PanelID            int64    `json:"panelID"`
	QueryRefId         string   `json:"queryRefId"`
	TotalMetrics       int64    `json:"totalMetrics"`
	FoundMetrics       int64    `json:"foundMetrics"`
	MissingMetrics     []string `json:"missingMetrics"`
	CompatibilityScore float64  `json:"compatibilityScore"`
}

// NewCreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown creates a new CreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown object.
func NewCreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown() *CreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown {
	return &CreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown{
		MissingMetrics: []string{},
	}
}

// +k8s:openapi-gen=true
type CreateCheckV1alpha1BodyDatasourceResults struct {
	Uid                string                                                   `json:"uid"`
	Type               string                                                   `json:"type"`
	Name               *string                                                  `json:"name,omitempty"`
	TotalQueries       int64                                                    `json:"totalQueries"`
	CheckedQueries     int64                                                    `json:"checkedQueries"`
	TotalMetrics       int64                                                    `json:"totalMetrics"`
	FoundMetrics       int64                                                    `json:"foundMetrics"`
	MissingMetrics     []string                                                 `json:"missingMetrics"`
	QueryBreakdown     []CreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown `json:"queryBreakdown"`
	CompatibilityScore float64                                                  `json:"compatibilityScore"`
}

// NewCreateCheckV1alpha1BodyDatasourceResults creates a new CreateCheckV1alpha1BodyDatasourceResults object.
func NewCreateCheckV1alpha1BodyDatasourceResults() *CreateCheckV1alpha1BodyDatasourceResults {
	return &CreateCheckV1alpha1BodyDatasourceResults{
		MissingMetrics: []string{},
		QueryBreakdown: []CreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown{},
	}
}
func (CreateCheckBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashvalidator.pkg.apis.dashvalidator.v1alpha1.CreateCheckBody"
}
func (CreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashvalidator.pkg.apis.dashvalidator.v1alpha1.CreateCheckV1alpha1BodyDatasourceResultsQueryBreakdown"
}
func (CreateCheckV1alpha1BodyDatasourceResults) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashvalidator.pkg.apis.dashvalidator.v1alpha1.CreateCheckV1alpha1BodyDatasourceResults"
}
