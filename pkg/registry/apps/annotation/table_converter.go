package annotation

import (
	"fmt"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var tableConverter = utils.NewTableConverter(
	annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Text", Type: "string", Format: "name"},
		},
		Reader: func(obj any) ([]any, error) {
			m, ok := obj.(*annotationV0.Annotation)
			if !ok {
				return nil, fmt.Errorf("expected Annotation")
			}
			return []any{
				m.Spec.Text,
			}, nil
		},
	},
)
