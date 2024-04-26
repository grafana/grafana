package annotationsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	readStore
	writeStore
}

type commonStore interface {
	Type() string
}

type readStore interface {
	commonStore
	Get(ctx context.Context, query *annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error)
	GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error)
}

type writeStore interface {
	commonStore
	Add(ctx context.Context, items *annotations.Item) error
	AddMany(ctx context.Context, items []annotations.Item) error
	Update(ctx context.Context, item *annotations.Item) error
	Delete(ctx context.Context, params *annotations.DeleteParams) error
	CleanAnnotations(ctx context.Context, cfg setting.AnnotationCleanupSettings, annotationType string) (int64, error)
	CleanOrphanedAnnotationTags(ctx context.Context) (int64, error)
}
