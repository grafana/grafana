package tag

import (
	"context"
)

type Service interface {
	EnsureTagsExist(ctx context.Context, tags []*Tag) ([]*Tag, error)
}
