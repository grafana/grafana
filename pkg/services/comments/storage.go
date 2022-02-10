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
	errUnknownContentType = errors.New("unknown content type")
	errEmptyObjectId      = errors.New("empty object id")
	errEmptyContent       = errors.New("empty comment content")
)

type Storage interface {
	Get(ctx context.Context, orgId int64, ct string, objectId string, filter GetFilter) ([]*commentmodel.Comment, error)
	Create(ctx context.Context, orgId int64, ct string, objectId string, userId int64, content string) (*commentmodel.Comment, error)
}
