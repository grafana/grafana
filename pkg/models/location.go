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
	OrgId     int64  `xorm:"not null unique(uix_location_for_account)"`
	Slug      string `xorm:"not null unique(uix_location_for_account)"` // The account being given access to
	Name      string
	Country   string
	Region    string
	Provider  string
	Public    bool
	Created   time.Time
	Updated   time.Time
}

// ----------------------
// COMMANDS

type AddLocationCommand struct {
	OrgId     int64  `json:"-"`
	Name      string `json:"name"`
	Country   string `json:"country"`
	Region    string `json:"region"`
	Provider  string `json:"provider"`
	Public    bool   `json:"public"`
	Result    *Location
}

type UpdateLocationCommand struct {
	Id        int64  `json:"id" binding:"required"`
	OrgId     int64  `json:"-"`
	Name      string `json:"name"`
	Country   string `json:"country"`
	Region    string `json:"region"`
	Provider  string `json:"provider"`
	Public    bool   `json:"public"`
}

type DeleteLocationCommand struct {
	Id        int64 `json:"id" binding:"required"`
	OrgId     int64 `json:"-"`
}

// ---------------------
// QUERIES

type GetLocationsQuery struct {
	LocationId []int64  `form:"id"`
	Slug       []string `form:"slug"`
	Name       []string `form:"name"`
	Country    []string `form:"country"`
	Region     []string `form:"region"`
	Provider   []string `form:"provider"`
	Public     string   `form:"public"`

	OrgId      int64
	Result    []*Location
}

type GetLocationByIdQuery struct {
	Id        int64
	OrgId     int64
	Result    Location
}

func (location *Location) UpdateLocationSlug() {
	name := strings.ToLower(location.Name)
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	location.Slug = re2.ReplaceAllString(re.ReplaceAllString(name, ""), "-")
}
