package models

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

// Typed errors
var (
	ErrLocationNotFound           = errors.New("Location not found")
	ErrLocationWithSameCodeExists = errors.New("A Location with the same code already exists")
)

type Location struct {
	Id        int64
	OrgId     int64
	Slug      string
	Name      string
	Public    bool
	Latitude  float64
	Longitude float64
	Created   time.Time
	Updated   time.Time
}

type LocationTag struct {
	Id         int64
	OrgId      int64
	LocationId int64
	Tag        string
}

// ----------------------
// DTO
type LocationDTO struct {
	Id        int64    `json:"id"`
	OrgId     int64    `json:"org_id"`
	Slug      string   `json:"slug"`
	Name      string   `json:"name"`
	Tags      []string `json:"tags"`
	Public    bool     `json:"public"`
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
}

// ----------------------
// COMMANDS

type AddLocationCommand struct {
	OrgId     int64   `json:"-"`
	Name      string  `json:"name"`
	Public    bool    `json:"public"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Result    *LocationDTO
}

type UpdateLocationCommand struct {
	Id        int64    `json:"id" binding:"required"`
	OrgId     int64    `json:"-"`
	Tags      []string `json:"tags"`
	Public    bool     `json:"public"`
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
}

type DeleteLocationCommand struct {
	Id    int64 `json:"id" binding:"required"`
	OrgId int64 `json:"-"`
}

type CopyPublicLocationTagsCmd struct {
	OrgId int64
}

// ---------------------
// QUERIES

type GetLocationsQuery struct {
	Slug   []string `form:"slug"`
	Name   []string `form:"name"`
	Tag    []string `form:"tag"`
	Public string   `form:"public"`
	OrgId  int64
	Result []*LocationDTO
}

type GetLocationByIdQuery struct {
	Id     int64
	OrgId  int64
	Result *LocationDTO
}

func (location *Location) UpdateLocationSlug() {
	name := strings.ToLower(location.Name)
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	location.Slug = re2.ReplaceAllString(re.ReplaceAllString(name, ""), "-")
}
