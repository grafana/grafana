package elasticstore

import (
	elastigo "github.com/mattbaird/elastigo/lib"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	es *elastigo.Conn
)

func Init() {
	host := setting.Cfg.Section("elasticsearch").Key("host").MustString("localhost")
	es = elastigo.NewConn()
	es.Domain = host
}