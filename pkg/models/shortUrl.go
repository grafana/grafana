package models

import (
	"errors"
	"time"
)

var (
	ErrShortUrlNotFound = errors.New("Short URL not found")
)

type ShortUrl struct {
	Uid        string
	Path       string
	CreatedBy  int64
	CreatedAt  time.Time
	LastSeenAt time.Time
}

// ---------------------
// COMMANDS

type CreateShortUrlCommand struct {
	Uid        string `json:"uid"`
	Path       string `json:"path"`
	CreatedBy  int64  `json:"userId"`
	CreatedAt  time.Time
	LastSeenAt time.Time

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
