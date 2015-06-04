package models

import (
	"errors"
	"time"
)

var ErrInvalidAlert = errors.New("Invalid Alert")

type Alert struct {
	Id        int64
	OrgId     int64
	Freq      uint32
	Offset    uint8 //offset on top of "even" minute/10s/.. intervals
	Expr      string
	LevelWarn float64
	LevelCrit float64
	Created   time.Time
	Updated   time.Time
}

type AddAlertCommand struct {
	OrgId     int64 `json:"-"`
	Freq      uint32
	Expr      string
	LevelWarn float64
	LevelCrit float64
	Result    *Alert
}

type DeleteAlertCommand struct {
	Id    int64 `json:"id"`
	OrgId int64 `json:"-"`
}

type GetAlertsQuery struct {
	OrgId  int64
	Result []*Alert
}

type GetAlertByIdQuery struct {
	Id     int64
	OrgId  int64
	Result *Alert
}
