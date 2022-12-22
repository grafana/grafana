package tagimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/tag"
)

type store interface {
	EnsureTagsExist(context.Context, []*tag.Tag) ([]*tag.Tag, error)
}
