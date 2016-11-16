package mqe

import (
	"net/http"

	"github.com/grafana/grafana/pkg/tsdb"
)

// wildcard as alias
// add host to alias
// add app to alias
// regular alias

type MQEResponseParser struct{}

func (parser *MQEResponseParser) Parse(res *http.Response) (*tsdb.QueryResult, error) {
	return nil, nil
}
