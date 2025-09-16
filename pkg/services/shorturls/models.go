package shorturls

import (
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrShortURLBadRequest   = errutil.BadRequest("shorturl.bad-request")
	ErrShortURLNotFound     = errutil.NotFound("shorturl.not-found")
	ErrShortURLAbsolutePath = errutil.ValidationFailed("shorturl.absolute-path", errutil.WithPublicMessage("Path should be relative"))
	ErrShortURLInvalidPath  = errutil.ValidationFailed("shorturl.invalid-path", errutil.WithPublicMessage("Invalid short URL path"))
	ErrShortURLInternal     = errutil.Internal("shorturl.internal")
	ErrShortURLConflict     = errutil.Conflict("shorturl.conflict")
)

type ShortUrl struct {
	Id         int64  `json:"-"`
	OrgId      int64  `json:"-"`
	Uid        string `json:"uid"`
	Path       string `json:"path"`
	CreatedBy  int64  `json:"-"`
	CreatedAt  int64  `json:"-"`
	LastSeenAt int64  `json:"lastSeenAt"`
}

type DeleteShortUrlCommand struct {
	Uid       string
	OlderThan time.Time

	NumDeleted int64
}
