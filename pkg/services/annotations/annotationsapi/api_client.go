package annotationsapi

import (
	"context"
	"fmt"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/user"
)

type annotationAPIClient struct {
	k8sClient client.K8sHandler
}

func (s *annotationAPIClient) Create(ctx context.Context, orgID int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	obj, err := toUnstructured(anno)
	if err != nil {
		return nil, err
	}
	result, err := s.k8sClient.Create(ctx, obj, orgID, v1.CreateOptions{})
	if err != nil {
		return nil, err
	}
	return fromUnstructured(result)
}

func (s *annotationAPIClient) Update(ctx context.Context, orgID int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	obj, err := toUnstructured(anno)
	if err != nil {
		return nil, err
	}
	result, err := s.k8sClient.Update(ctx, obj, orgID, v1.UpdateOptions{})
	if err != nil {
		return nil, err
	}
	return fromUnstructured(result)
}

func (s *annotationAPIClient) Delete(ctx context.Context, orgID int64, name string) error {
	return s.k8sClient.Delete(ctx, name, orgID, v1.DeleteOptions{})
}

func (s *annotationAPIClient) List(ctx context.Context, orgID int64, opts v1.ListOptions) ([]*annotationV0.Annotation, error) {
	list, err := s.k8sClient.List(ctx, orgID, opts)
	if err != nil {
		return nil, err
	}
	annos := make([]*annotationV0.Annotation, 0, len(list.Items))
	for i := range list.Items {
		anno, err := fromUnstructured(&list.Items[i])
		if err != nil {
			continue
		}
		annos = append(annos, anno)
	}
	return annos, nil
}

func (s *annotationAPIClient) GetByLegacyID(ctx context.Context, orgID int64, annotationID int64) (*annotationV0.Annotation, error) {
	list, err := s.k8sClient.List(ctx, orgID, v1.ListOptions{
		FieldSelector: fmt.Sprintf("metadata.legacyID=%d", annotationID),
	})
	if err != nil {
		return nil, err
	}
	if len(list.Items) == 0 {
		return nil, ErrNotFound
	}
	return fromUnstructured(&list.Items[0])
}

func (s *annotationAPIClient) GetUsersFromMeta(ctx context.Context, usersMeta []string) (map[string]*user.User, error) {
	return s.k8sClient.GetUsersFromMeta(ctx, usersMeta)
}

func toUnstructured(anno *annotationV0.Annotation) (*unstructured.Unstructured, error) {
	obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(anno)
	if err != nil {
		return nil, fmt.Errorf("annotation to unstructured: %w", err)
	}
	return &unstructured.Unstructured{Object: obj}, nil
}

func fromUnstructured(obj *unstructured.Unstructured) (*annotationV0.Annotation, error) {
	var anno annotationV0.Annotation
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &anno); err != nil {
		return nil, fmt.Errorf("unstructured to annotation: %w", err)
	}
	return &anno, nil
}
