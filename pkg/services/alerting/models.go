package alerting

type Job struct {
	Offset  int64
	Delay   bool
	Running bool
	Rule    *Rule
}

type ResultLogEntry struct {
	Message string
	Data    interface{}
}

type EvalMatch struct {
	Value  float64
	Metric string
	Tags   map[string]string
}

type Level struct {
	Operator string
	Value    float64
}
