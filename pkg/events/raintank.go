package events

import (
	m "github.com/grafana/grafana/pkg/models"
	"time"
)

// Events can be passed to external systems via for example AMPQ
// Treat these events as basically DTOs so changes has to be backward compatible

type MonitorPayload struct {
	Id            int64                  `json:"id"`
	SiteId        int64                  `json:"site_id"`
	AccountId     int64                  `json:"account_id"`
	Name          string                 `json:"name"`
	Slug          string                 `json:"slug"`
	MonitorTypeId int64                  `json:"monitor_type_id"`
	Locations     []int64                `json:"locations"`
	Settings      []*m.MonitorSettingDTO `json:"settings"`
	Frequency     int64                  `json:"frequency"`
	Enabled       bool                   `json:"enabled"`
	Offset        int64                  `json:"offset"`
}

type MonitorUpdated struct {
	MonitorPayload
	Timestamp time.Time       `json:"timestamp"`
	Updated   time.Time       `json:"updated"`
	LastState *MonitorPayload `json:"last_state"`
}

type MonitorCreated struct {
	MonitorPayload
	Timestamp time.Time `json:"timestamp"`
}

type MonitorRemoved struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
	SiteId    int64     `json:"site_id"`
	AccountId int64     `json:"account_id"`
	Locations []int64   `json:"locations"`
}

type SitePayload struct {
	Id        int64  `json:"id"`
	AccountId int64  `json:"account_id"`
	Slug      string `json:"slug"`
	Name      string `json:"name"`
}

type SiteUpdated struct {
	SitePayload
	Timestamp time.Time    `json:"timestamp"`
	LastState *SitePayload `json:"last_state"`
}

type SiteCreated struct {
	SitePayload
	Timestamp time.Time `json:"timestamp"`
}

type SiteRemoved struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
	AccountId int64     `json:"account_id"`
}
