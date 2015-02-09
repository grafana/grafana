package events

import (
	"reflect"
	"time"
        m "github.com/grafana/grafana/pkg/models"
)

// Events can be passed to external systems via for example AMPQ
// Treat these events as basically DTOs so changes has to be backward compatible

type Priority string

const (
	PRIO_DEBUG Priority = "DEBUG"
	PRIO_INFO  Priority = "INFO"
	PRIO_ERROR Priority = "ERROR"
)

type Event struct {
	Timestamp time.Time `json:"timestamp"`
}

type OnTheWireEvent struct {
	EventType string      `json:"event_type"`
	Priority  Priority    `json:"priority"`
	Timestamp time.Time   `json:"timestamp"`
	Payload   interface{} `json:"payload"`
}

type EventBase interface {
	ToOnWriteEvent() *OnTheWireEvent
}

func ToOnWriteEvent(event interface{}) (*OnTheWireEvent, error) {
	eventType := reflect.TypeOf(event).Elem()

	wireEvent := OnTheWireEvent{
		Priority:  PRIO_INFO,
		EventType: eventType.Name(),
		Payload:   event,
	}

	baseField := reflect.Indirect(reflect.ValueOf(event)).FieldByName("Timestamp")
	if baseField.IsValid() {
		wireEvent.Timestamp = baseField.Interface().(time.Time)
	} else {
		wireEvent.Timestamp = time.Now()
	}

	return &wireEvent, nil
}

type AccountCreated struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
}

type AccountUpdated struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
}

type UserCreated struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
	Login     string    `json:"login"`
	Email     string    `json:"email"`
}

type UserUpdated struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
	Login     string    `json:"login"`
	Email     string    `json:"email"`
}
type MonitorUpdated struct {
	Timestamp     time.Time              `json:"timestamp"`
	Id            int64                  `json:"id"`
	AccountId     int64                  `json:"account_id"`
	Name          string                 `json:"name"`
	Slug          string                 `json:"slug"`
	MonitorTypeId int64                  `json:"monitor_type_id"`
	Locations     []int64                `json:"locations"`
	Settings      []*m.MonitorSettingDTO `json:"settings"`
	Frequency     int64                  `json:"frequency"`
	Enabled       bool                   `json:"enabled"`
	Offset        int64                  `json:"offset"`
        Updated       time.Time              `json:"updated"`
}

