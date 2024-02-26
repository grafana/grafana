package kinds

import (
	"embed"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

var _ resource.TypedQueryParser[TestDataDataQuery] = (*TestdataQueryHandler)(nil)

type TestdataQueryHandler struct {
	k8s   *v0alpha1.QueryTypeDefinitionList
	field string
}

//go:embed query.types.json
var f embed.FS

func NewQueryHandler() (*TestdataQueryHandler, error) {
	h := &TestdataQueryHandler{
		k8s: &v0alpha1.QueryTypeDefinitionList{},
	}

	body, err := h.QueryTypeDefinitionsJSON()
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(body, h.k8s)
	if err != nil {
		return nil, err
	}

	for _, qt := range h.k8s.Items {
		if h.field == "" {
			h.field = qt.Spec.DiscriminatorField
		} else if qt.Spec.DiscriminatorField != "" {
			if qt.Spec.DiscriminatorField != h.field {
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
func (h *TestdataQueryHandler) QueryTypeDefinitionList() *v0alpha1.QueryTypeDefinitionList {
	return h.k8s
}

// ReadQuery implements query.TypedQueryHandler.
func (*TestdataQueryHandler) ParseQuery(
	// Properties that have been parsed off the same node
	common resource.CommonQueryProperties,
	// An iterator with context for the full node (include common values)
	iter *jsoniter.Iterator,
) (TestDataDataQuery, error) {
	q := &TestDataDataQuery{}
	err := iter.ReadVal(q)
	return *q, err
}
