package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Typed errors
var (
	ErrMonitorNotFound          = errors.New("Monitor not found")
	ErrMonitorCollectorsInvalid = errors.New("Invalid Collector specified for Monitor")
	ErrMonitorSettingsInvalid   = errors.New("Invald variables used in Monitor Settings")
	ErrorEndpointCantBeChanged  = errors.New("A monitor's endpoint_id can not be changed.")
)

type CheckEvalResult int

const (
	EvalResultOK CheckEvalResult = iota
	EvalResultWarn
	EvalResultCrit
	EvalResultUnknown = -1
)

func (c CheckEvalResult) String() string {
	switch c {
	case EvalResultOK:
		return "OK"
	case EvalResultWarn:
		return "Warning"
	case EvalResultCrit:
		return "Critical"
	case EvalResultUnknown:
		return "Unknown"
	default:
		panic(fmt.Sprintf("Invalid CheckEvalResult value %d", int(c)))
	}
}

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
	Id             int64
	OrgId          int64
	EndpointId     int64
	MonitorTypeId  int64
	Offset         int64
	Frequency      int64
	Enabled        bool
	State          CheckEvalResult
	StateChange    time.Time
	StateCheck     time.Time
	Settings       []*MonitorSettingDTO
	HealthSettings *MonitorHealthSettingDTO
	Created        time.Time
	Updated        time.Time
}

type MonitorCollector struct {
	Id          int64
	MonitorId   int64
	CollectorId int64
}
type MonitorCollectorTag struct {
	Id        int64
	MonitorId int64
	Tag       string
}

// ---------------
// DTOs

type MonitorSettingDTO struct {
	Variable string `json:"variable"`
	Value    string `json:"value"`
}

type MonitorHealthSettingDTO struct {
	NumCollectors int                        `json:"num_collectors"`
	Steps         int                        `json:"steps"`
	Notifications MonitorNotificationSetting `json:"notifications"`
}

type MonitorNotificationSetting struct {
	Enabled   bool   `json:"enabled"`
	Addresses string `json:"addresses"`
}

// implement the go-xorm/core.Conversion interface
func (e *MonitorHealthSettingDTO) FromDB(data []byte) error {
	return json.Unmarshal(data, e)
}

func (e *MonitorHealthSettingDTO) ToDB() ([]byte, error) {
	return json.Marshal(e)
}

type MonitorForAlertDTO struct {
	Id              int64
	OrgId           int64
	EndpointId      int64
	EndpointSlug    string
	MonitorTypeId   int64
	MonitorTypeName string
	Offset          int64
	Frequency       int64
	Enabled         bool
	StateChange     time.Time
	StateCheck      time.Time
	Settings        []*MonitorSettingDTO
	HealthSettings  *MonitorHealthSettingDTO
	Created         time.Time
	Updated         time.Time
}

type MonitorDTO struct {
	Id              int64                    `json:"id"`
	OrgId           int64                    `json:"org_id"`
	EndpointId      int64                    `json:"endpoint_id"`
	EndpointSlug    string                   `json:"endpoint_slug"`
	MonitorTypeId   int64                    `json:"monitor_type_id" binding:"required"`
	MonitorTypeName string                   `json:"monitor_type_name"`
	CollectorIds    []int64                  `json:"collector_ids"`
	CollectorTags   []string                 `json:"collector_tags"`
	Collectors      []int64                  `json:"collectors"`
	State           CheckEvalResult          `json:"state"`
	StateChange     time.Time                `json:"state_change"`
	StateCheck      time.Time                `json:"state_check"`
	Settings        []*MonitorSettingDTO     `json:"settings"`
	HealthSettings  *MonitorHealthSettingDTO `json:"health_settings"`
	Frequency       int64                    `json:"frequency"`
	Enabled         bool                     `json:"enabled"`
	Offset          int64                    `json:"offset"`
	Updated         time.Time                `json:"updated"`
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
	OrgId          int64                    `json:"-"`
	EndpointId     int64                    `json:"endpoint_id" binding:"required"`
	MonitorTypeId  int64                    `json:"monitor_type_id" binding:"required"`
	CollectorIds   []int64                  `json:"collector_ids"`
	CollectorTags  []string                 `json:"collector_tags"`
	Settings       []*MonitorSettingDTO     `json:"settings"`
	HealthSettings *MonitorHealthSettingDTO `json:"health_settings"`
	Frequency      int64                    `json:"frequency"`
	Enabled        bool                     `json:"enabled"`
	Offset         int64                    `json:"-"`
	Result         *MonitorDTO
}

type UpdateMonitorCommand struct {
	Id             int64                    `json:"id" binding:"required"`
	EndpointId     int64                    `json:"endpoint_id" binding:"required"`
	OrgId          int64                    `json:"-"`
	MonitorTypeId  int64                    `json:"monitor_type_id" binding:"required"`
	CollectorIds   []int64                  `json:"collector_ids"`
	CollectorTags  []string                 `json:"collector_tags"`
	Settings       []*MonitorSettingDTO     `json:"settings"`
	HealthSettings *MonitorHealthSettingDTO `json:"health_settings"`
	Frequency      int64                    `json:"frequency"`
	Enabled        bool                     `json:"enabled"`
	Offset         int64                    `json:"-"`
}

type DeleteMonitorCommand struct {
	Id    int64 `json:"id" binding:"required"`
	OrgId int64 `json:"-"`
}

type UpdateMonitorStateCommand struct {
	Id       int64
	State    CheckEvalResult
	Updated  time.Time
	Checked  time.Time
	Affected int
}

// ---------------------
// QUERIES

type GetMonitorsQuery struct {
	MonitorId      []int64         `form:"id"`
	EndpointId     []int64         `form:"endpoint_id"`
	MonitorTypeId  []int64         `form:"monitor_type_id"`
	CollectorId    []int64         `form:"collector_id"`
	Frequency      []int64         `form:"frequency"`
	Enabled        string          `form:"enabled"`
	Modulo         int64           `form:"modulo"`
	ModuloOffset   int64           `form:"modulo_offset"`
	State          CheckEvalResult `form:"state"`
	OrgId          int64
	IsGrafanaAdmin bool
	Result         []*MonitorDTO
}

type GetMonitorByIdQuery struct {
	Id             int64
	OrgId          int64
	IsGrafanaAdmin bool
	Result         *MonitorDTO
}

type GetMonitorsForAlertsQuery struct {
	Timestamp int64
	Result    []*MonitorForAlertDTO
}

type GetMonitorTypesQuery struct {
	Result []*MonitorTypeDTO
}

type GetMonitorTypeByIdQuery struct {
	Id     int64
	Result *MonitorTypeDTO
}
