// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type CreateCheckBody struct {
	CompatibilityScore float64                                    `json:"compatibilityScore"`
	DatasourceResults  []V1alpha1CreateCheckBodyDatasourceResults `json:"datasourceResults"`
}

// NewCreateCheckBody creates a new CreateCheckBody object.
func NewCreateCheckBody() *CreateCheckBody {
	return &CreateCheckBody{
		DatasourceResults: []V1alpha1CreateCheckBodyDatasourceResults{},
	}
}

// +k8s:openapi-gen=true
type V1alpha1CreateCheckBodyDatasourceResultsQueryBreakdown struct {
	PanelTitle         string   `json:"panelTitle"`
	PanelID            int64    `json:"panelID"`
	QueryRefId         string   `json:"queryRefId"`
	TotalMetrics       int64    `json:"totalMetrics"`
	FoundMetrics       int64    `json:"foundMetrics"`
	MissingMetrics     []string `json:"missingMetrics"`
	CompatibilityScore float64  `json:"compatibilityScore"`
}

// NewV1alpha1CreateCheckBodyDatasourceResultsQueryBreakdown creates a new V1alpha1CreateCheckBodyDatasourceResultsQueryBreakdown object.
func NewV1alpha1CreateCheckBodyDatasourceResultsQueryBreakdown() *V1alpha1CreateCheckBodyDatasourceResultsQueryBreakdown {
	return &V1alpha1CreateCheckBodyDatasourceResultsQueryBreakdown{
		MissingMetrics: []string{},
	}
}

// +k8s:openapi-gen=true
type V1alpha1CreateCheckBodyDatasourceResults struct {
	Uid                string                                                   `json:"uid"`
	Type               string                                                   `json:"type"`
	Name               *string                                                  `json:"name,omitempty"`
	TotalQueries       int64                                                    `json:"totalQueries"`
	CheckedQueries     int64                                                    `json:"checkedQueries"`
	TotalMetrics       int64                                                    `json:"totalMetrics"`
	FoundMetrics       int64                                                    `json:"foundMetrics"`
	MissingMetrics     []string                                                 `json:"missingMetrics"`
	QueryBreakdown     []V1alpha1CreateCheckBodyDatasourceResultsQueryBreakdown `json:"queryBreakdown"`
	CompatibilityScore float64                                                  `json:"compatibilityScore"`
}

// NewV1alpha1CreateCheckBodyDatasourceResults creates a new V1alpha1CreateCheckBodyDatasourceResults object.
func NewV1alpha1CreateCheckBodyDatasourceResults() *V1alpha1CreateCheckBodyDatasourceResults {
	return &V1alpha1CreateCheckBodyDatasourceResults{
		MissingMetrics: []string{},
		QueryBreakdown: []V1alpha1CreateCheckBodyDatasourceResultsQueryBreakdown{},
	}
}
