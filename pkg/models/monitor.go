package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrMonitorNotFound         = errors.New("Monitor not found")
	ErrMonitorLocationsInvalid = errors.New("Invalid Location specified for Monitor")
	ErrMonitorSettingsInvalid  = errors.New("Invald variables used in Monitor Settings")
	ErrorEndpointCantBeChanged = errors.New("A monitor's endpoint_id can not be changed.")
)

type MonitorType struct {
	Id      int64
	Name    string
	Created time.Time
	Updated time.Time
}

type MonitorTypeSetting struct {
	Id            int64
	MonitorTypeId int64
	Variable      string
	Description   string
	Required      bool
	DataType      string
	DefaultValue  string
	Conditions    map[string]interface{}
}

type Monitor struct {
	Id            int64
	OrgId         int64
	EndpointId    int64
	Namespace     string
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
	MonitorId  int64
	LocationId int64
}

// ---------------
// DTOs

type MonitorSettingDTO struct {
	Variable string `json:"variable"`
	Value    string `json:"value"`
}

type MonitorDTO struct {
	Id            int64                `json:"id"`
	OrgId         int64                `json:"org_id"`
	EndpointId    int64                `json:"endpoint_id"`
	Namespace     string               `json:"namespace"`
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
	Id       int64                    `json:"id"`
	Name     string                   `json:"name"`
	Settings []*MonitorTypeSettingDTO `json:"settings"`
}

// ----------------------
// COMMANDS

type AddMonitorCommand struct {
	OrgId         int64                `json:"-"`
	EndpointId    int64                `json:"endpoint_id" binding:"required"`
	MonitorTypeId int64                `json:"monitor_type_id" binding:"required"`
	Namespace     string               `json:"namespace"`
	Locations     []int64              `json:"locations"`
	Settings      []*MonitorSettingDTO `json:"settings"`
	Frequency     int64                `json:"frequency"`
	Enabled       bool                 `json:"enabled"`
	Offset        int64                `json:"-"`
	Result        *MonitorDTO
}

type UpdateMonitorCommand struct {
	Id            int64                `json:"id" binding:"required"`
	EndpointId    int64                `json:"endpoint_id" binding:"required"`
	OrgId         int64                `json:"-"`
	Namespace     string               `json:"namespace"`
	MonitorTypeId int64                `json:"monitor_type_id" binding:"required"`
	Locations     []int64              `json:"locations"`
	Settings      []*MonitorSettingDTO `json:"settings"`
	Frequency     int64                `json:"frequency"`
	Enabled       bool                 `json:"enabled"`
	Offset        int64                `json:"-"`
}

type DeleteMonitorCommand struct {
	Id    int64 `json:"id" binding:"required"`
	OrgId int64 `json:"-"`
}

// ---------------------
// QUERIES

type GetMonitorsQuery struct {
	MonitorId       []int64 `form:"id"`
	EndpointId      []int64 `form:"endpoint_id"`
	MonitorTypeId   []int64 `form:"monitor_type_id"`
	LocationId      []int64 `form:"location_id"`
	Frequency       []int64 `form:"frequency"`
	Enabled         string  `form:"enabled"`
	Modulo          int64   `form:"modulo"`
	ModuloOffset    int64   `form:"modulo_offset"`
	OrgId           int64
	IsRaintankAdmin bool
	Result          []*MonitorDTO
}

type GetMonitorByIdQuery struct {
	Id              int64
	OrgId           int64
	IsRaintankAdmin bool
	Result          *MonitorDTO
}

type GetMonitorTypesQuery struct {
	Result []*MonitorTypeDTO
}

type GetMonitorTypeByIdQuery struct {
	Id     int64
	Result *MonitorTypeDTO
}
