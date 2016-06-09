package alerting

type AlertJob struct {
	Offset     int64
	Delay      bool
	Running    bool
	RetryCount int
	Rule       *AlertRule
}

type AlertResult struct {
	State       string
	ActualValue float64
	Duration    float64
	Description string
	Error       error
	AlertJob    *AlertJob
}

type AlertRule struct {
	Id          int64
	OrgId       int64
	DashboardId int64
	PanelId     int64
	//WarnLevel    float64
	//CritLevel    float64
	//WarnOperator string
	//CritOperator string
	Frequency   int64
	Name        string
	Description string
	State       string

	Warning  Level
	Critical Level

	ValueQuery AlertQuery
	EvalFunc   string
	EvalQuery  AlertQuery
	EvalParam  string
}

type Level struct {
	Operator string
	Level    float64
}

type AlertQuery struct {
	Query        string
	DatasourceId int64
	Aggregator   string
	From         int64
	Until        int64
}
