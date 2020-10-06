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

// ---------------------
// COMMANDS

type CreateShortURLCommand struct {
	OrgID     int64  `json:"-"`
	UID       string `json:"uid"`
	Path      string `json:"path"`
	CreatedBy int64  `json:"-"`

	Result *ShortUrl
}

type UpdateShortURLLastSeenAtCommand struct {
	OrgID int64
	UID   string
}

// ---------------------
// QUERIES
//

type GetShortURLByUIDQuery struct {
	OrgID int64
	UID   string

	Result *ShortUrl
}
