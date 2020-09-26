package models

import (
	"errors"
)

var (
	ErrShortUrlNotFound = errors.New("Short URL not found")
)

type ShortUrl struct {
	Uid        string
	Path       string
	CreatedBy  int64
	CreatedAt  int64
	LastSeenAt int64
}

// ---------------------
// COMMANDS

type CreateShortUrlCommand struct {
	Uid       string `json:"uid"`
	Path      string `json:"path"`
	CreatedBy int64  `json:"userId"`

	Result *ShortUrl
}

type UpdateShortUrlLastSeenAtCommand struct {
	Uid string
}

// ---------------------
// QUERIES
//

type GetFullUrlQuery struct {
	Uid string

	Result *ShortUrl
}
