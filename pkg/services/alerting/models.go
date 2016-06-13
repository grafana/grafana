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

type Level struct {
	Operator string
	Level    float64
}

type AlertQuery struct {
	Query        string
	DatasourceId int64
	Aggregator   string
	From         string
	To           string
}
