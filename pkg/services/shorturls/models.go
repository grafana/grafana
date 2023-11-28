package shorturls

import (
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrShortURLBadRequest   = errutil.BadRequest("shorturl.bad-request")
	ErrShortURLNotFound     = errutil.NotFound("shorturl.not-found")
	ErrShortURLAbsolutePath = errutil.ValidationFailed("shorturl.absolute-path", errutil.WithPublicMessage("Path should be relative"))
	ErrShortURLInvalidPath  = errutil.ValidationFailed("shorturl.invalid-path", errutil.WithPublicMessage("Invalid short URL path"))
	ErrShortURLInternal     = errutil.Internal("shorturl.internal")
)

type ShortUrl struct {
	Id         int64
	OrgId      int64
	Uid        string
	Path       string
	CreatedBy  int64
	CreatedAt  int64
	LastSeenAt int64
}

type DeleteShortUrlCommand struct {
	OlderThan time.Time

	NumDeleted int64
}
