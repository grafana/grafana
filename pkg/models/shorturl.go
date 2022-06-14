package models

import (
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrShortURLNotFound = errutil.NewBase(errutil.StatusNotFound, "shorturl.not-found")
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
