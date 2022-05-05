package comments

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/comments/commentmodel"
)

type GetFilter struct {
	Limit    uint
	BeforeID int64
}

var (
	errUnknownObjectType = errors.New("unknown object type")
	errEmptyObjectID     = errors.New("empty object id")
	errEmptyContent      = errors.New("empty comment content")
)

type Storage interface {
	Get(ctx context.Context, orgID int64, objectType string, objectID string, filter GetFilter) ([]*commentmodel.Comment, error)
	Create(ctx context.Context, orgID int64, objectType string, objectID string, userID int64, content string) (*commentmodel.Comment, error)
}
