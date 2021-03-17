package telegraf

import (
	"github.com/influxdata/telegraf/plugins/parsers"
	"github.com/influxdata/telegraf/plugins/parsers/influx"
)

func NewInfluxParser() parsers.Parser {
	handler := influx.NewMetricHandler()
	return influx.NewParser(handler)
}
