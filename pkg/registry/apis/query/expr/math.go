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

var _ helper.QueryTypeSupport[query.ExpressionQuery] = (*MathExpressionSupport)(nil)
var _ query.ExpressionQuery = (*MathQuery)(nil)

type MathExpressionSupport struct{}

// QueryType implements v0alpha1.QueryTypeSupport.
func (*MathExpressionSupport) QueryType() string {
	return "math"
}

// Versions implements v0alpha1.QueryTypeSupport.
func (*MathExpressionSupport) Versions() []query.QueryTypeDefinition {
	return []query.QueryTypeDefinition{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "math",
			},
			Spec: query.QueryTypeSpec{
				Description: "execute math expression",
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
func (*MathExpressionSupport) ReadQuery(generic query.GenericDataQuery, version string) (query.ExpressionQuery, error) {
	val, ok := generic.AdditionalProperties()["expression"]
	if !ok {
		return nil, fmt.Errorf("missing expression")
	}
	expression, ok := val.(string)
	if !ok {
		return nil, fmt.Errorf("expression must be a string type")
	}
	return &MathQuery{raw: expression}, nil
}

type MathQuery struct {
	raw string
}

func (s *MathQuery) Variables() []string {
	return []string{"A"} // the values defined in the query
}

func (s *MathQuery) Execute(ctx context.Context, input query.QueryDataResponse) (backend.DataResponse, error) {
	return backend.DataResponse{}, nil
}
