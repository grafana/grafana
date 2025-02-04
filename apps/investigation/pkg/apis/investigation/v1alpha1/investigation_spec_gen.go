// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// AbsoluteTimeRange is a time range specified by absolute timestamps.
// +k8s:openapi-gen=true
type InvestigationAbsoluteTimeRange struct {
	From float64 `json:"from"`
	To   float64 `json:"to"`
}

// NewInvestigationAbsoluteTimeRange creates a new InvestigationAbsoluteTimeRange object.
func NewInvestigationAbsoluteTimeRange() *InvestigationAbsoluteTimeRange {
	return &InvestigationAbsoluteTimeRange{}
}

// Comment is a comment on an investigation item.
// +k8s:openapi-gen=true
type InvestigationComment struct {
	AuthorUserID string `json:"authorUserID"`
	BodyMarkdown string `json:"bodyMarkdown"`
}

// NewInvestigationComment creates a new InvestigationComment object.
func NewInvestigationComment() *InvestigationComment {
	return &InvestigationComment{}
}

// DatasourceRef is a reference to a datasource.
// +k8s:openapi-gen=true
type InvestigationDatasourceRef struct {
	Uid        string `json:"uid"`
	Type       string `json:"type"`
	ApiVersion string `json:"apiVersion"`
	Name       string `json:"name"`
}

// NewInvestigationDatasourceRef creates a new InvestigationDatasourceRef object.
func NewInvestigationDatasourceRef() *InvestigationDatasourceRef {
	return &InvestigationDatasourceRef{}
}

// DataQueryLogs is a data query for logs.
// +k8s:openapi-gen=true
type InvestigationDataQueryLogs struct {
	// refId is the reference ID of the query.
	RefId string `json:"refId"`
	// datasource is the datasource of the query.
	Datasource InvestigationDatasourceRef `json:"datasource"`
	// expr is the expression of the query.
	Expr string `json:"expr"`
	// maxLines (optional) is used to limit the number of log rows returned.
	MaxLines *int64 `json:"maxLines,omitempty"`
}

// NewInvestigationDataQueryLogs creates a new InvestigationDataQueryLogs object.
func NewInvestigationDataQueryLogs() *InvestigationDataQueryLogs {
	return &InvestigationDataQueryLogs{
		Datasource: *NewInvestigationDatasourceRef(),
	}
}

// DataQueryMetrics is a data query for metrics.
// +k8s:openapi-gen=true
type InvestigationDataQueryMetrics struct {
	RefId      string                     `json:"refId"`
	Datasource InvestigationDatasourceRef `json:"datasource"`
	Expr       string                     `json:"expr"`
}

// NewInvestigationDataQueryMetrics creates a new InvestigationDataQueryMetrics object.
func NewInvestigationDataQueryMetrics() *InvestigationDataQueryMetrics {
	return &InvestigationDataQueryMetrics{
		Datasource: *NewInvestigationDatasourceRef(),
	}
}

// InvestigationItem is an item in an investigation.
// +k8s:openapi-gen=true
type InvestigationInvestigationItem struct {
	Id    string `json:"id"`
	Title string `json:"title"`
	// type is the type of the item "timeseries", "heatmap", "log-table" (not an enum to allow for future extensions).
	Type string `json:"type"`
	// url is the URL to the item.
	Url string `json:"url"`
	// origin is where the item was created from.
	// "explore-metrics", "explore-logs", "explore-traces" (not an enum to allow for future extensions)
	Origin string `json:"origin"`
	// iconPath (optional) is the path to the icon for the item.
	IconPath *string `json:"iconPath,omitempty"`
	// timeRange (optional) is the time range of the item.
	TimeRange InvestigationAbsoluteTimeRange `json:"timeRange"`
	// note (optional) is a comment on the item.
	Note []InvestigationComment `json:"note,omitempty"`
	// queryType is the type of the query used to generate this item.
	QueryType InvestigationInvestigationItemQueryType `json:"queryType"`
	// dataQuery contains the query used to generate this item.
	DataQuery interface{} `json:"dataQuery"`
}

// NewInvestigationInvestigationItem creates a new InvestigationInvestigationItem object.
func NewInvestigationInvestigationItem() *InvestigationInvestigationItem {
	return &InvestigationInvestigationItem{
		TimeRange: *NewInvestigationAbsoluteTimeRange(),
	}
}

// spec is the schema of our resource. The spec should include all the user-ediable information for the kind.
// +k8s:openapi-gen=true
type InvestigationSpec struct {
	Title  string                           `json:"title"`
	Status InvestigationSpecStatus          `json:"status"`
	Items  []InvestigationInvestigationItem `json:"items"`
}

// NewInvestigationSpec creates a new InvestigationSpec object.
func NewInvestigationSpec() *InvestigationSpec {
	return &InvestigationSpec{}
}

// +k8s:openapi-gen=true
type InvestigationInvestigationItemQueryType string

const (
	InvestigationInvestigationItemQueryTypeLogs    InvestigationInvestigationItemQueryType = "logs"
	InvestigationInvestigationItemQueryTypeMetrics InvestigationInvestigationItemQueryType = "metrics"
)

// +k8s:openapi-gen=true
type InvestigationSpecStatus string

const (
	InvestigationSpecStatusOpen   InvestigationSpecStatus = "open"
	InvestigationSpecStatusClosed InvestigationSpecStatus = "closed"
)
