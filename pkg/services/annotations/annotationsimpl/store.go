package annotationsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/annotations"
)

type store interface {
	Add(ctx context.Context, item *annotations.Item) error
	Update(ctx context.Context, item *annotations.Item) error
	Get(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error)
	Delete(ctx context.Context, params *annotations.DeleteParams) error
	GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error)
}
