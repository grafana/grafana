package dataquery2

import (
	"embed"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/query"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

var _ query.TypedQueryHandler[PrometheusDataQuery] = (*PrometheusQueyHandler)(nil)

type PrometheusQueyHandler struct {
	k8s   *v0alpha1.QueryTypeDefinitionList
	field string
}

//go:embed types.json
var f embed.FS

func NewQueryHandler() (*PrometheusQueyHandler, error) {
	h := &PrometheusQueyHandler{
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
func (h *PrometheusQueyHandler) QueryTypeDefinitionsJSON() (json.RawMessage, error) {
	return f.ReadFile("types.json")
}

// QueryTypes implements query.TypedQueryHandler.
func (h *PrometheusQueyHandler) QueryTypeDefinitionList() *v0alpha1.QueryTypeDefinitionList {
	return h.k8s
}

// ReadQuery implements query.TypedQueryHandler.
func (*PrometheusQueyHandler) ReadQuery(
	// The query type split by version (when multiple exist)
	queryType string, version string,
	// Properties that have been parsed off the same node
	common query.CommonQueryProperties,
	// An iterator with context for the full node (include common values)
	iter *jsoniter.Iterator,
) (PrometheusDataQuery, error) {
	q := &PrometheusDataQuery{}
	err := iter.ReadVal(q)
	return *q, err
}
