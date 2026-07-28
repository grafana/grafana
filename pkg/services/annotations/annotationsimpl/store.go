package annotationsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
)

type Store interface {
	ReadStore
	WriteStore
}

type CommonStore interface {
	Type() string
}

type ReadStore interface {
	CommonStore
	Get(ctx context.Context, query annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error)
	GetTags(ctx context.Context, query annotations.TagsQuery) (annotations.FindTagsResult, error)
}

type WriteStore interface {
	CommonStore
	Add(ctx context.Context, items *annotations.Item) error
	AddMany(ctx context.Context, items []annotations.Item) error
	Update(ctx context.Context, item *annotations.Item) error
	Delete(ctx context.Context, params *annotations.DeleteParams) error
	CleanAnnotations(ctx context.Context, cfg setting.AnnotationCleanupSettings, annotationType string) (int64, error)
	CleanOrphanedAnnotationTags(ctx context.Context) (int64, error)
}
