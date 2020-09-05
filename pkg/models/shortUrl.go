package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrShortUrlNotFound = errors.New("Short URL not found")
)

type ShortUrl struct {
	Uid       string
	Path      string
	CreatedBy int64
	CreatedAt time.Time
}

// ---------------------
// COMMANDS

type CreateShortUrlCommand struct {
	Uid       string `json:"uid"`
	Path      string `json:"path"`
	CreatedBy int64  `json:"userId"`
	CreatedAt time.Time

	Result *ShortUrl
}

//
// QUERIES
//

type GetFullUrlQuery struct {
	Uid string

	Result *ShortUrl
}
