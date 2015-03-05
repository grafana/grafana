package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrEndpointNotFound = errors.New("Endpoint not found")
)

type Endpoint struct {
	Id      int64
	OrgId   int64
	Name    string
	Created time.Time
	Updated time.Time
}

// ---------------
// DTOs
type EndpointDTO struct {
	Id    int64  `json:"id"`
	OrgId int64  `json:"org_id"`
	Name  string `json:"name"`
}

type NewEndpointDTO struct {
	Endpoint          *EndpointDTO        `json:"endpoint"`
	SuggestedMonitors []*SuggestedMonitor `json:"suggested_monitors"`
}

type SuggestedMonitor struct {
	MonitorTypeId int64               `json:"monitor_type_id"`
	Settings      []MonitorSettingDTO `json:"settings"`
}

// ----------------------
// COMMANDS
type EndpointDiscoveryCommand struct {
	Endpoint *EndpointDTO
	Result   *NewEndpointDTO
}

type AddEndpointCommand struct {
	OrgId  int64  `json:"-"`
	Name   string `json:"name"`
	Result *EndpointDTO
}

type UpdateEndpointCommand struct {
	Id     int64  `json:"id" binding:"required"`
	OrgId  int64  `json:"-"`
	Name   string `json:"name"`
	Result *EndpointDTO
}

type DeleteEndpointCommand struct {
	Id    int64 `json:"id" binding:"required"`
	OrgId int64 `json:"-"`
}

// ---------------------
// QUERIES

type GetEndpointsQuery struct {
	OrgId  int64
	Result []*EndpointDTO
}

type GetEndpointByIdQuery struct {
	Id     int64
	OrgId  int64
	Result *EndpointDTO
}
