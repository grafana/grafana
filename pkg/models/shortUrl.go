package models

import (
	"errors"
)

var (
	ErrShortUrlNotFound = errors.New("Short URL not found")
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

// ---------------------
// COMMANDS

type CreateShortUrlCommand struct {
	OrgId     int64  `json:"orgId"`
	Uid       string `json:"uid"`
	Path      string `json:"path"`
	CreatedBy int64  `json:"userId"`

	Result *ShortUrl
}

type UpdateShortUrlLastSeenAtCommand struct {
	OrgId int64
	Uid   string
}

// ---------------------
// QUERIES
//

type GetFullUrlQuery struct {
	OrgId int64
	Uid   string

	Result *ShortUrl
}
