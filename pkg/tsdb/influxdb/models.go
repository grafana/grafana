package influxdb

type Query struct {
	Measurement  string
	Policy       string
	ResultFormat string
	Tags         []*Tag
	GroupBy      []*QueryPart
	Selects      []*Select
}

type Tag struct {
	Key      string
	Operator string
	Value    string
}

type Select []QueryPart

type InfluxDbSelect struct {
	Type string
}
