package loki

import "time"

type lokiQuery struct {
	Expr         string
	QueryType    string
	Step         time.Duration
	MaxLines     int
	LegendFormat string
	Start        time.Time
	End          time.Time
	RefID        string
	VolumeQuery  bool
}
