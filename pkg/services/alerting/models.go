package alerting

type Job struct {
	Offset     int64
	OffsetWait bool
	Delay      bool
	Running    bool
	Rule       *Rule
}

type ResultLogEntry struct {
	Message string
	Data    interface{}
}

type EvalMatch struct {
	Value  float64           `json:"value"`
	Metric string            `json:"metric"`
	Tags   map[string]string `json:"tags"`
}

type Level struct {
	Operator string
	Value    float64
}
