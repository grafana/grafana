package annotations

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrTimerangeMissing     = errors.New("missing timerange")
	ErrBaseTagLimitExceeded = errutil.NewBase(errutil.StatusBadRequest, "annotations.tag-limit-exceeded", errutil.WithPublicMessage("Tags length exceeds the maximum allowed."))
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
