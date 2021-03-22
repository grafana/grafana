package telegraf

import (
	"github.com/influxdata/telegraf/plugins/parsers"
	"github.com/influxdata/telegraf/plugins/parsers/influx"
)

// NewInfluxParser returns new metric parser.
func NewInfluxParser() parsers.Parser {
	return influx.NewParser(influx.NewMetricHandler())
}
