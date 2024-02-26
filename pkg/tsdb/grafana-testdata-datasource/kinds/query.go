package kinds

import (
	"embed"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
)

var _ resource.TypedQueryParser[TestDataDataQuery] = (*TestdataQueryHandler)(nil)

type TestdataQueryHandler struct {
	types *resource.QueryTypeDefinitionList
	field string
}

//go:embed query.types.json
var f embed.FS

func NewQueryHandler() (*TestdataQueryHandler, error) {
	h := &TestdataQueryHandler{
		types: &resource.QueryTypeDefinitionList{},
	}

	body, err := h.QueryTypeDefinitionsJSON()
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(body, h.types)
	if err != nil {
		return nil, err
	}

	for _, qt := range h.types.Items {
		for _, f := range qt.Spec.Discriminators {
			if h.field == "" {
				h.field = f.Field
			} else if f.Field != h.field {
				return nil, fmt.Errorf("only one discriminator field allowed")
			}
		}
	}
	return h, nil
}

// QueryTypes implements query.TypedQueryHandler.
func (h *TestdataQueryHandler) QueryTypeDefinitionsJSON() (json.RawMessage, error) {
	return f.ReadFile("dataquery.types.json")
}

// QueryTypes implements query.TypedQueryHandler.
func (h *TestdataQueryHandler) QueryTypeDefinitionList() *resource.QueryTypeDefinitionList {
	return h.types
}

// ReadQuery implements query.TypedQueryHandler.
func (*TestdataQueryHandler) ParseQuery(
	// Properties that have been parsed off the same node
	common resource.CommonQueryProperties,
	// An iterator with context for the full node (include common values)
	iter *jsoniter.Iterator,
	// Now shared across all
	_ time.Time,
) (TestDataDataQuery, error) {
	q := &TestDataDataQuery{}
	err := iter.ReadVal(q)
	return *q, err
}
