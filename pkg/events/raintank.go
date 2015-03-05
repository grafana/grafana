package events

import (
	m "github.com/grafana/grafana/pkg/models"
	"time"
)

// Events can be passed to external systems via for example AMPQ
// Treat these events as basically DTOs so changes has to be backward compatible

type MonitorPayload struct {
	Id            int64                  `json:"id"`
	OrgId         int64                  `json:"org_id"`
	Endpoint      EndpointPayload        `json:"endpoint"`
	Namespace     string                 `json:"namespace"`
	MonitorTypeId int64                  `json:"monitor_type_id"`
	Locations     []int64                `json:"locations"`
	Settings      []*m.MonitorSettingDTO `json:"settings"`
	Frequency     int64                  `json:"frequency"`
	Enabled       bool                   `json:"enabled"`
	Offset        int64                  `json:"offset"`
	Updated       time.Time       `json:"updated"`
}

type MonitorUpdated struct {
	MonitorPayload
	Timestamp time.Time       `json:"timestamp"`
	LastState *MonitorPayload `json:"last_state"`
}

type MonitorCreated struct {
	MonitorPayload
	Timestamp time.Time `json:"timestamp"`
}

type MonitorRemoved struct {
	Timestamp time.Time       `json:"timestamp"`
	Id        int64           `json:"id"`
	Endpoint  EndpointPayload `json:"endpoint"`
	OrgId     int64           `json:"org_id"`
	Locations []int64         `json:"locations"`
}

type EndpointPayload struct {
	Id    int64  `json:"id"`
	OrgId int64  `json:"org_id"`
	Name  string `json:"name"`
}

type EndpointUpdated struct {
	EndpointPayload
	Timestamp time.Time        `json:"timestamp"`
	LastState *EndpointPayload `json:"last_state"`
}

type EndpointCreated struct {
	EndpointPayload
	Timestamp time.Time `json:"timestamp"`
}

type EndpointRemoved struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
	OrgId     int64     `json:"org_id"`
}
