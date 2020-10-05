package models

import (
	"errors"
)

var (
	ErrShortURLNotFound = errors.New("Short URL not found")
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

type CreateShortURLCommand struct {
	OrgId     int64  `json:"-"`
	Uid       string `json:"uid"`
	Path      string `json:"path"`
	CreatedBy int64  `json:"-"`

	Result *ShortUrl
}

type UpdateShortURLLastSeenAtCommand struct {
	OrgId int64
	Uid   string
}

// ---------------------
// QUERIES
//

type GetShortURLByUIDQuery struct {
	OrgId int64
	Uid   string

	Result *ShortUrl
}
