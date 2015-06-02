package elasticstore

import (
	"strconv"
	"github.com/grafana/grafana/pkg/setting"
	elastigo "github.com/mattbaird/elastigo/lib"
)

var (
	es *elastigo.Conn
)

func Init() {
	host := setting.Cfg.Section("elasticsearch").Key("host").MustString("localhost")
	port := setting.Cfg.Section("elasticsearch").Key("port").MustInt64(9200)
	es = elastigo.NewConn()
	es.Domain = host
	es.Port = strconv.FormatInt(port, 10)
}
