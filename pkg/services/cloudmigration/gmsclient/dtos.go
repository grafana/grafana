package gmsclient

import "time"

type MigrateDataType string

type MigrateDataRequestDTO struct {
	Items []MigrateDataRequestItemDTO `json:"items"`
}

type MigrateDataRequestItemDTO struct {
	Type  MigrateDataType `json:"type"`
	RefID string          `json:"refId"`
	Name  string          `json:"name"`
	Data  interface{}     `json:"data"`
}

type ItemStatus string

const (
	ItemStatusOK    ItemStatus = "OK"
	ItemStatusError ItemStatus = "ERROR"
)

type MigrateDataResponseDTO struct {
	RunUID string                       `json:"uid"`
	Items  []MigrateDataResponseItemDTO `json:"items"`
}

type MigrateDataResponseListDTO struct {
	RunUID string `json:"uid"`
}

type MigrateDataResponseItemDTO struct {
	// required:true
	Type MigrateDataType `json:"type"`
	// required:true
	RefID string `json:"refId"`
	// required:true
	Status ItemStatus `json:"status"`
	Error  string     `json:"error,omitempty"`
}

type CreateSnapshotUploadUrlResponseDTO struct {
	UploadUrl string `json:"uploadUrl"`
}

type EventRequestDTO struct {
	LocalID            string         `json:"migrationClientId"`
	Event              LocalEventType `json:"event"`
	Error              string         `json:"error"`
	DurationIfFinished time.Duration  `json:"duration"`
	UserUID            string         `json:"userUid"`
	GrafanaVersion     string         `json:"grafanaVersion"`
}

type LocalEventType string

const (
	EventConnect                LocalEventType = "connect"
	EventDisconnect             LocalEventType = "disconnect"
	EventStartBuildingSnapshot  LocalEventType = "start_building_snapshot"
	EventDoneBuildingSnapshot   LocalEventType = "done_building_snapshot"
	EventStartUploadingSnapshot LocalEventType = "start_uploading_snapshot"
	EventDoneUploadingSnapshot  LocalEventType = "done_uploading_snapshot"
)

type GMSAPIError struct {
	Message string `json:"message"`
}

// Error messages returned from GMS
var (
	GMSErrorMessageInstanceUnreachable   = "instance is unreachable"
	GMSErrorMessageInstanceCheckingError = "checking if instance is reachable"
	GMSErrorMessageInstanceFetching      = "fetching instance by stack id"
)
