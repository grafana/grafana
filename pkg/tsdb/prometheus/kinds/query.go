package kinds

import (
	"embed"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
)

var _ resource.TypedQueryParser[PrometheusDataQuery] = (*PrometheusQueyHandler)(nil)

type PrometheusQueyHandler struct{}

func NewQueryHandler() (*PrometheusQueyHandler, error) {
	h := &PrometheusQueyHandler{}
	return h, nil
}

//go:embed query.types.json
var f embed.FS

// QueryTypes implements query.TypedQueryHandler.
func (h *PrometheusQueyHandler) QueryTypeDefinitionsJSON() (json.RawMessage, error) {
	return f.ReadFile("query.types.json")
}

// ReadQuery implements query.TypedQueryHandler.
func (*PrometheusQueyHandler) ParseQuery(
	// Properties that have been parsed off the same node
	common resource.CommonQueryProperties,
	// An iterator with context for the full node (include common values)
	iter *jsoniter.Iterator,
	// now shared across all queries
	_ time.Time,
) (PrometheusDataQuery, error) {
	q := &PrometheusDataQuery{}
	err := iter.ReadVal(q)
	return *q, err
}
