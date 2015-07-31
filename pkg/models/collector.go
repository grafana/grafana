package models

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

// Typed errors
var (
	ErrCollectorNotFound           = errors.New("Collector not found")
	ErrCollectorWithSameCodeExists = errors.New("A Collector with the same code already exists")
)

type Collector struct {
	Id            int64
	OrgId         int64
	Slug          string
	Name          string
	Public        bool
	Latitude      float64
	Longitude     float64
	Created       time.Time
	Updated       time.Time
	Online        bool
	OnlineChange  time.Time
	Enabled       bool
	EnabledChange time.Time
}

type CollectorTag struct {
	Id          int64
	OrgId       int64
	CollectorId int64
	Tag         string
}

type CollectorSession struct {
	Id          int64
	OrgId       int64
	CollectorId int64
	SocketId    string
	InstanceId  string
	Updated     time.Time
}

// ----------------------
// DTO
type CollectorDTO struct {
	Id            int64     `json:"id"`
	OrgId         int64     `json:"org_id"`
	Slug          string    `json:"slug"`
	Name          string    `json:"name"`
	Tags          []string  `json:"tags"`
	Public        bool      `json:"public"`
	Latitude      float64   `json:"latitude"`
	Longitude     float64   `json:"longitude"`
	Online        bool      `json:"online"`
	OnlineChange  time.Time `json:"online_change"`
	Enabled       bool      `json:"enabled"`
	EnabledChange time.Time `json:"enabled_change"`
}

// ----------------------
// COMMANDS

type AddCollectorCommand struct {
	OrgId     int64    `json:"-"`
	Name      string   `json:"name"`
	Tags      []string `json:"tags"`
	Public    bool     `json:"public"`
	Online    bool     `json:"online"`
	Enabled   bool     `json:"enabled"`
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
	Result    *CollectorDTO
}

type UpdateCollectorCommand struct {
	Id        int64    `json:"id" binding:"required"`
	OrgId     int64    `json:"-"`
	Name      string   `json:"name"`
	Tags      []string `json:"tags"`
	Public    bool     `json:"public"`
	Enabled   bool     `json:"enabled"`
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
}

type DeleteCollectorCommand struct {
	Id    int64 `json:"id" binding:"required"`
	OrgId int64 `json:"-"`
}

type AddCollectorSessionCommand struct {
	CollectorId int64
	SocketId    string
	OrgId       int64
	InstanceId  string
}

type UpdateCollectorSessionCmd struct {
	CollectorId int64
	SocketId    string
	OrgId       int64
	InstanceId  string
}

type DeleteCollectorSessionCommand struct {
	OrgId       int64
	SocketId    string
	CollectorId int64
}

type ClearCollectorSessionCommand struct {
	InstanceId string
}

// ---------------------
// QUERIES

type GetCollectorsQuery struct {
	Slug   []string `form:"slug"`
	Name   []string `form:"name"`
	Tag    []string `form:"tag"`
	Public string   `form:"public"`
	OrgId  int64
	Result []*CollectorDTO
}

type GetCollectorByIdQuery struct {
	Id     int64
	OrgId  int64
	Result *CollectorDTO
}

type GetCollectorByNameQuery struct {
	Name   string
	OrgId  int64
	Result *CollectorDTO
}

func (collector *Collector) UpdateCollectorSlug() {
	name := strings.ToLower(collector.Name)
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	collector.Slug = re2.ReplaceAllString(re.ReplaceAllString(name, ""), "-")
}

type GetCollectorSessionsQuery struct {
	CollectorId int64
	InstanceId  string
	Result      []*CollectorSession
}

type GetAllCollectorTagsQuery struct {
	OrgId  int64
	Result []string
}
