package expr

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1/helper"
)

var _ helper.QueryTypeSupport[query.ExpressionQuery] = (*ReduceExpressionSupport)(nil)
var _ query.ExpressionQuery = (*ReduceQuery)(nil)

type ReduceExpressionSupport struct{}

// QueryType implements v0alpha1.QueryTypeSupport.
func (*ReduceExpressionSupport) QueryType() string {
	return "reduce"
}

// Versions implements v0alpha1.QueryTypeSupport.
func (*ReduceExpressionSupport) Versions() []query.QueryTypeDefinition {
	return []query.QueryTypeDefinition{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "reduce",
			},
			Spec: query.QueryTypeSpec{
				Description: "reduce query results",
				Versions: []query.QueryTypeVersion{
					{
						Schema: v0alpha1.Unstructured{
							Object: map[string]any{
								"TODO": "JSONSchema",
							},
						},
						Changelog: []string{
							"migrate from untyped",
						},
					},
				},
			},
		},
	}
}

// ReadQuery implements v0alpha1.QueryTypeSupport.
func (*ReduceExpressionSupport) ReadQuery(generic query.GenericDataQuery, version string) (query.ExpressionQuery, error) {
	return nil, fmt.Errorf("not implemented yet")
}

type ReduceQuery struct {
	// raw string
}

func (s *ReduceQuery) Variables() []string {
	return []string{"A"} // the values defined in the query
}

func (s *ReduceQuery) Execute(ctx context.Context, input query.QueryDataResponse) (backend.DataResponse, error) {
	return backend.DataResponse{}, nil
}
