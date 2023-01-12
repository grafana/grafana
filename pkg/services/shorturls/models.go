package shorturls

import (
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrShortURLBadRequest   = errutil.NewBase(errutil.StatusBadRequest, "shorturl.bad-request")
	ErrShortURLNotFound     = errutil.NewBase(errutil.StatusNotFound, "shorturl.not-found")
	ErrShortURLAbsolutePath = errutil.NewBase(errutil.StatusValidationFailed, "shorturl.absolute-path", errutil.WithPublicMessage("Path should be relative"))
	ErrShortURLInvalidPath  = errutil.NewBase(errutil.StatusValidationFailed, "shorturl.invalid-path", errutil.WithPublicMessage("Invalid short URL path"))
	ErrShortURLInternal     = errutil.NewBase(errutil.StatusInternal, "shorturl.internal")
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
