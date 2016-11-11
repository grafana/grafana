package mqe

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MQEQueryParser struct{}

func (qp *MQEQueryParser) Parse(model *simplejson.Json, dsInfo *tsdb.DataSourceInfo) (*MQEQuery, error) {
	return nil, nil
}
