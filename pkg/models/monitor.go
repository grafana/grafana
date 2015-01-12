package models

import (
	"time"
	"errors"
	"regexp"
	"strings"
)

// Typed errors
var (
	ErrMonitorNotFound           = errors.New("Monitor not found")
	ErrMonitorLocationsInvalid   = errors.New("Invalid Location specified for Monitor")
	ErrMonitorSettingsInvalid    = errors.New("Invald variables used in Monitor Settings")
)

type MonitorType struct {
	Id 			int64
	Name 		string
	PanelTemplate map[string]interface{}
	Created 	time.Time
	Updated 	time.Time
}

type MonitorTypeSetting struct {
	Id 			  int64
	MonitorTypeId int64   `xorm:"not null unique(uix_MonitorTypeSettingVariable)"`
	Variable      string  `xorm:"not null unique(uix_MonitorTypeSettingVariable)"`
	Description   string
	Required      bool
	DataType      string
	DefaultValue  string
	Conditions    map[string]interface{}
}

type Monitor struct {
	Id            int64
	AccountId     int64    `xorm:"not null unique(uix_AccountIdSlug)"`
	Slug		  string    `xorm:"not null unique(uix_AccountIdSlug)"`
	Name		  string
	MonitorTypeId int64
	Offset		  int64
	Settings      []*MonitorSettingDTO
	Created 	  time.Time
	Updated 	  time.Time
}

type MonitorLocation struct {
	Id 			  int64
	MonitorId     int64 `xorm:"not null unique(uix_MonitorLocation)"`
	LocationId    int64 `xorm:"not null unique(uix_MonitorLocation)"`
}


// ---------------
// DTOs

type MonitorSettingDTO struct {
	Variable  string  `json:"variable"`
	Value     string  `json:"value"`
}

type MonitorDTO struct {
	Id             int64                    	`json:"id"`
	AccountId      int64    				  	`json:"-"`
	Name           string   					`json:"name" binding:"required"`
	MonitorTypeId  int64    					`json:"monitor_type_id" binding:"required"` 
	Locations      []int64  					`json:"locations"`
	Settings       []*MonitorSettingDTO      	`json:"settings"`
}

type MonitorTypeSettingDTO struct {
	Variable      string  					`json:"variable"`
	Description   string  					`json:"description"`
	Required      bool    					`json:"required"`
	DataType      string  					`json:"data_type"`
	Conditions    map[string]interface{} 	`json:"conditions"`
	DefaultValue  string					`json:"default_value"`
}

type MonitorTypeDTO struct {	
	Id 			  int64								`json:"id"`
	Name 		  string							`json:"name"`
	PanelTemplate map[string]interface{}      	    `json:"panel_template"`
	Settings      []*MonitorTypeSettingDTO      	`json:"settings"`
}

// ----------------------
// COMMANDS

type AddMonitorCommand struct {
	AccountId      int64    `json:"-"`
	Name           string   `json:"name" binding:"required"`
	MonitorTypeId  int64    `json:"monitor_type_id" binding:"required"` 
	Locations      []int64  `json:"locations"`
	Settings       []*MonitorSettingDTO `json:"settings"`
	Result         *MonitorDTO
}

type UpdateMonitorCommand struct {
	Id             int64    `json:"id" binding:"required"`
	AccountId      int64    `json:"-"`
	Name           string   `json:"name" binding:"required"`
	MonitorTypeId  int64    `json:"monitor_type" binding:"required"` 
	Locations      []int64  `json:"locations"`
	Settings       []*MonitorSettingDTO `json:"settings"`
}

type DeleteMonitorCommand struct {
	Id          int64     `json:"id" binding:"required"`
	AccountId   int64     `json:"-"`
}

// ---------------------
// QUERIES

type GetMonitorsQuery struct {
	AccountId int64
	Result    []*MonitorDTO
}

type GetMonitorByIdQuery struct {
	Id        int64
	AccountId int64
	Result    *MonitorDTO
}


type GetMonitorTypesQuery struct {
	Result    []*MonitorTypeDTO
}

type GetMonitorTypeByIdQuery struct {
	Id 		int64	
	Result 	*MonitorTypeDTO
}

func (monitor *Monitor) UpdateMonitorSlug() {
	name := strings.ToLower(monitor.Name)
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	monitor.Slug = re2.ReplaceAllString(re.ReplaceAllString(name, ""), "-")
}