package elasticstore

import (
	"github.com/grafana/grafana/pkg/setting"
	elastigo "github.com/mattbaird/elastigo/lib"
)

var (
	es *elastigo.Conn
)

func Init() {
	host := setting.Cfg.Section("elasticsearch").Key("host").MustString("localhost")
	es = elastigo.NewConn()
	es.Domain = host
}
