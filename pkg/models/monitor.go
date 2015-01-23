package models

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

// Typed errors
var (
	ErrMonitorNotFound         = errors.New("Monitor not found")
	ErrMonitorLocationsInvalid = errors.New("Invalid Location specified for Monitor")
	ErrMonitorSettingsInvalid  = errors.New("Invald variables used in Monitor Settings")
)

type MonitorType struct {
	Id            int64
	Name          string
	PanelTemplate map[string]interface{}
	Created       time.Time
	Updated       time.Time
}

type MonitorTypeSetting struct {
	Id            int64
	MonitorTypeId int64  `xorm:"not null unique(uix_MonitorTypeSettingVariable)"`
	Variable      string `xorm:"not null unique(uix_MonitorTypeSettingVariable)"`
	Description   string
	Required      bool
	DataType      string
	DefaultValue  string
	Conditions    map[string]interface{}
}

type Monitor struct {
	Id            int64
	AccountId     int64  `xorm:"not null unique(uix_AccountIdSlug)"`
	Slug          string `xorm:"not null unique(uix_AccountIdSlug)"`
	Name          string
	MonitorTypeId int64
	Offset        int64
	Frequency     int64
	Enabled       bool
	Settings      []*MonitorSettingDTO
	Created       time.Time
	Updated       time.Time
}

type MonitorLocation struct {
	Id         int64
	MonitorId  int64 `xorm:"not null unique(uix_MonitorLocation)"`
	LocationId int64 `xorm:"not null unique(uix_MonitorLocation)"`
}

// ---------------
// DTOs

type MonitorSettingDTO struct {
	Variable string `json:"variable"`
	Value    string `json:"value"`
}

type MonitorDTO struct {
	Id            int64                `json:"id"`
	AccountId     int64                `json:"account_id"`
	Name          string               `json:"name" binding:"required"`
	Slug          string               `json:"slug"`
	MonitorTypeId int64                `json:"monitor_type_id" binding:"required"`
	Locations     []int64              `json:"locations"`
	Settings      []*MonitorSettingDTO `json:"settings"`
	Frequency     int64                `json:"frequency"`
	Enabled       bool                 `json:"enabled"`
	Offset        int64                `json:"offset"`
}

type MonitorTypeSettingDTO struct {
	Variable     string                 `json:"variable"`
	Description  string                 `json:"description"`
	Required     bool                   `json:"required"`
	DataType     string                 `json:"data_type"`
	Conditions   map[string]interface{} `json:"conditions"`
	DefaultValue string                 `json:"default_value"`
}

type MonitorTypeDTO struct {
	Id            int64                    `json:"id"`
	Name          string                   `json:"name"`
	PanelTemplate map[string]interface{}   `json:"panel_template"`
	Settings      []*MonitorTypeSettingDTO `json:"settings"`
}

// ----------------------
// COMMANDS

type AddMonitorCommand struct {
	AccountId     int64                `json:"-"`
	Name          string               `json:"name" binding:"required"`
	MonitorTypeId int64                `json:"monitor_type_id" binding:"required"`
	Locations     []int64              `json:"locations"`
	Settings      []*MonitorSettingDTO `json:"settings"`
	Frequency     int64                `json:"frequency"`
	Enabled       bool                 `json:"enabled"`
	Offset        int64                `json:"-"`
	Result        *MonitorDTO
}

type UpdateMonitorCommand struct {
	Id            int64                `json:"id" binding:"required"`
	AccountId     int64                `json:"-"`
	Name          string               `json:"name" binding:"required"`
	MonitorTypeId int64                `json:"monitor_type_id" binding:"required"`
	Locations     []int64              `json:"locations"`
	Settings      []*MonitorSettingDTO `json:"settings"`
	Frequency     int64                `json:"frequency"`
	Enabled       bool                 `json:"enabled"`
	Offset        int64                `json:"-"`
}

type DeleteMonitorCommand struct {
	Id        int64 `json:"id" binding:"required"`
	AccountId int64 `json:"-"`
}

// ---------------------
// QUERIES

type GetMonitorsQuery struct {
	MonitorId      []int64  `form:"id"`
	Name           []string `form:"name"`
	Slug           []string `form:"slug"`
	MonitorTypeId  []int64  `form:"monitor_type_id"`
	LocationId     []int64  `form:"location_id"`
	Frequency      []int64  `form:"frequency"`
	Enabled        string   `form:"enabled"`
	AccountId      int64
	IsRaintankAdmin bool
	Result         []*MonitorDTO
}

type GetMonitorByIdQuery struct {
	Id             int64
	AccountId      int64
	IsRaintankAdmin bool
	Result         *MonitorDTO
}

type GetMonitorTypesQuery struct {
	Result []*MonitorTypeDTO
}

type GetMonitorTypeByIdQuery struct {
	Id     int64
	Result *MonitorTypeDTO
}

func (monitor *Monitor) UpdateMonitorSlug() {
	name := strings.ToLower(monitor.Name)
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	monitor.Slug = re2.ReplaceAllString(re.ReplaceAllString(name, ""), "-")
}
