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
	EndpointId    int64                  `json:"endpoint_id"`
	Namespace     string                 `json:"namespace"`
	MonitorTypeId int64                  `json:"monitor_type_id"`
	CollectorIds  []int64                `json:"collector_ids"`
	CollectorTags []string               `json:"collector_tags"`
	Collectors    []int64                `json:"collectors"`
	Settings      []*m.MonitorSettingDTO `json:"settings"`
	Frequency     int64                  `json:"frequency"`
	Enabled       bool                   `json:"enabled"`
	Offset        int64                  `json:"offset"`
	Updated       time.Time              `json:"updated"`
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
	Timestamp     time.Time `json:"timestamp"`
	Id            int64     `json:"id"`
	EndpointId    int64     `json:"endpoint_id"`
	OrgId         int64     `json:"org_id"`
	CollectorIds  []int64   `json:"collectors_ids"`
	CollectorTags []string  `json:"collectors_tags"`
}

type EndpointPayload struct {
	Id    int64    `json:"id"`
	OrgId int64    `json:"org_id"`
	Name  string   `json:"name"`
	Tags  []string `json:"tags"`
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
	Tags      []string  `json:"tags"`
}
