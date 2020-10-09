package models

import (
	"errors"
)

var (
	ErrShortURLNotFound = errors.New("short URL not found")
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
