package annotations

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrTimerangeMissing = errors.New("missing timerange")
)

type Repository interface {
	Save(ctx context.Context, item *Item) error
	Update(ctx context.Context, item *Item) error
	Find(ctx context.Context, query *ItemQuery) ([]*ItemDTO, error)
	Delete(ctx context.Context, params *DeleteParams) error
	FindTags(ctx context.Context, query *TagsQuery) (FindTagsResult, error)
}

// AnnotationCleaner is responsible for cleaning up old annotations
type AnnotationCleaner interface {
	CleanAnnotations(ctx context.Context, cfg *setting.Cfg) (int64, int64, error)
}

// var repositoryInstance Repository
var cleanerInstance AnnotationCleaner

func GetAnnotationCleaner() AnnotationCleaner {
	return cleanerInstance
}

func SetAnnotationCleaner(rep AnnotationCleaner) {
	cleanerInstance = rep
}
