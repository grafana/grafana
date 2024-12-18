package v1alpha1

// Defines values for InvestigationInvestigationItemQueryType.
const (
	InvestigationInvestigationItemQueryTypeLogs    InvestigationInvestigationItemQueryType = "logs"
	InvestigationInvestigationItemQueryTypeMetrics InvestigationInvestigationItemQueryType = "metrics"
)

// Defines values for InvestigationSpecStatus.
const (
	InvestigationSpecStatusClosed InvestigationSpecStatus = "closed"
	InvestigationSpecStatusOpen   InvestigationSpecStatus = "open"
)

// AbsoluteTimeRange is a time range specified by absolute timestamps.
// +k8s:openapi-gen=true
type InvestigationAbsoluteTimeRange struct {
	From float32 `json:"from"`
	To   float32 `json:"to"`
}

// Comment is a comment on an investigation item.
// +k8s:openapi-gen=true
type InvestigationComment struct {
	AuthorUserID string `json:"authorUserID"`
	BodyMarkdown string `json:"bodyMarkdown"`
}

// DataQueryLogs is a data query for logs.
// +k8s:openapi-gen=true
type InvestigationDataQueryLogs struct {
	// DatasourceRef is a reference to a datasource.
	Datasource InvestigationDatasourceRef `json:"datasource"`

	// expr is the expression of the query.
	Expr string `json:"expr"`

	// maxLines (optional) is used to limit the number of log rows returned.
	MaxLines *int64 `json:"maxLines,omitempty"`

	// refId is the reference ID of the query.
	RefId string `json:"refId"`
}

// DataQueryMetrics is a data query for metrics.
// +k8s:openapi-gen=true
type InvestigationDataQueryMetrics struct {
	// DatasourceRef is a reference to a datasource.
	Datasource InvestigationDatasourceRef `json:"datasource"`
	Expr       string                     `json:"expr"`
	RefId      string                     `json:"refId"`
}

// DatasourceRef is a reference to a datasource.
// +k8s:openapi-gen=true
type InvestigationDatasourceRef struct {
	ApiVersion string `json:"apiVersion"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	Uid        string `json:"uid"`
}

// InvestigationItem is an item in an investigation.
// +k8s:openapi-gen=true
type InvestigationInvestigationItem struct {
	// dataQuery contains the query used to generate this item.
	DataQuery interface{} `json:"dataQuery"`

	// iconPath (optional) is the path to the icon for the item.
	IconPath *string `json:"iconPath,omitempty"`
	Id       string  `json:"id"`

	// note (optional) is a comment on the item.
	Note []InvestigationComment `json:"note,omitempty"`

	// origin is where the item was created from.
	Origin string `json:"origin"`

	// queryType is the type of the query used to generate this item.
	QueryType InvestigationInvestigationItemQueryType `json:"queryType"`

	// AbsoluteTimeRange is a time range specified by absolute timestamps.
	TimeRange InvestigationAbsoluteTimeRange `json:"timeRange"`
	Title     string                         `json:"title"`

	// type is the type of the item "timeseries", "heatmap", "log-table" (not an enum to allow for future extensions).
	Type string `json:"type"`

	// url is the URL to the item.
	Url string `json:"url"`
}

// InvestigationInvestigationItemQueryType queryType is the type of the query used to generate this item.
// +k8s:openapi-gen=true
type InvestigationInvestigationItemQueryType string

// InvestigationSpec defines model for InvestigationSpec.
// +k8s:openapi-gen=true
type InvestigationSpec struct {
	Items  []InvestigationInvestigationItem `json:"items"`
	Status InvestigationSpecStatus          `json:"status"`
	Title  string                           `json:"title"`
}

// InvestigationSpecStatus defines model for InvestigationSpec.Status.
// +k8s:openapi-gen=true
type InvestigationSpecStatus string
