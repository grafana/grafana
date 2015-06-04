package alerting

import (
	"github.com/Dieterbe/statsd-go"
)

var Stat *statsd.Client

func Init(s *statsd.Client) {
	Stat = s
}
