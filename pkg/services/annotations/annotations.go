package annotations

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrTimerangeMissing     = errors.New("missing timerange")
	ErrBaseTagLimitExceeded = errutil.BadRequest("annotations.tag-limit-exceeded", errutil.WithPublicMessage("Tags length exceeds the maximum allowed."))
)

//go:generate mockery --name Repository --structname FakeAnnotationsRepo --inpackage --filename annotations_repository_mock.go
type Repository interface {
	Save(ctx context.Context, item *Item) error
	SaveMany(ctx context.Context, items []Item) error
	Update(ctx context.Context, item *Item) error
	Find(ctx context.Context, query *ItemQuery) ([]*ItemDTO, error)
	Delete(ctx context.Context, params *DeleteParams) error
	FindTags(ctx context.Context, query *TagsQuery) (FindTagsResult, error)
}

// Cleaner is responsible for cleaning up old annotations
type Cleaner interface {
	Run(ctx context.Context, cfg *setting.Cfg) (int64, int64, error)
}

type Store interface {
	ReadStore
	WriteStore
}

type CommonStore interface {
	Type() string
}

type ReadStore interface {
	CommonStore
	Get(ctx context.Context, query *ItemQuery, accessResources *AccessResources) ([]*ItemDTO, error)
	GetTags(ctx context.Context, query *TagsQuery) (FindTagsResult, error)
}

type WriteStore interface {
	CommonStore
	Add(ctx context.Context, items *Item) error
	AddMany(ctx context.Context, items []Item) error
	Update(ctx context.Context, item *Item) error
	Delete(ctx context.Context, params *DeleteParams) error
	CleanAnnotations(ctx context.Context, cfg setting.AnnotationCleanupSettings, annotationType string) (int64, error)
	CleanOrphanedAnnotationTags(ctx context.Context) (int64, error)
}
