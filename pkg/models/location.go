package models

import (
	"time"
	"errors"
)

// Typed errors
var (
	ErrLocationNotFound           = errors.New("Location not found")
	ErrLocationWithSameCodeExists = errors.New("A Location with the same code already exists")
)

type Location struct {
	Id          int64
	AccountId   int64    `xorm:"not null unique(uix_location_for_account)"`
	Code		string    `xorm:"not null unique(uix_location_for_account)"` // The account being given access to
	Name		string
	Country		string
	Region	    string
	Provider	string
	Created 	time.Time
	Updated 	time.Time
}

// ----------------------
// COMMANDS

type AddLocationCommand struct {
	Code        string    `json:"code" binding:"required"`
	AccountId    int64    `json:"-"`
	Name		string    `json:"name"`
	Country		string    `json:"country"`
	Region	    string    `json:"region"`
	Provider	string    `json:"provider"`
	Result      *Location
}

type UpdateLocationCommand struct {
	Id          int64     `json:"id" binding:"required"`
	AccountId   int64     `json:"-"`
	Code        string    `json:"code"`
	Name		string    `json:"name"`
	Country		string    `json:"country"`
	Region	    string    `json:"region"`
	Provider	string    `json:"provider"`
}

type DeleteLocationCommand struct {
	Id          int64     `json:"id" binding:"required"`
	AccountId   int64     `json:"-"`
}

// ---------------------
// QUERIES

type GetLocationsQuery struct {
	AccountId int64
	Result    []*Location
}

type GetLocationByCodeQuery struct {
	Code      string
	AccountId int64
	Result    Location
}