package annotation

import (
	"context"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
)

type Store interface {
	Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error)
	List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error)
	Create(ctx context.Context, annotation *annotationV0.Annotation) (*annotationV0.Annotation, error)
	Update(ctx context.Context, annotation *annotationV0.Annotation) (*annotationV0.Annotation, error)
	Delete(ctx context.Context, namespace, name string) error
}

type ListOptions struct {
	DashboardUID string
	PanelID      int64
	From         int64
	To           int64
	Limit        int64
	Continue     string
}

type AnnotationList struct {
	Items    []annotationV0.Annotation
	Continue string
}

type LifecycleManager interface {
	Cleanup(ctx context.Context) (int64, error)
}

type TagProvider interface {
	ListTags(ctx context.Context, namespace string, opts TagListOptions) ([]Tag, error)
}

type TagListOptions struct {
	Prefix string
	Limit  int
}

type Tag struct {
	Name  string
	Count int64
}
