package events

import (
	"reflect"
	"time"
)

// Events can be passed to external systems via for example AMQP
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

type OrgCreated struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
}

type OrgUpdated struct {
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

type UserSignedUp struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
	Login     string    `json:"login"`
	Email     string    `json:"email"`
}

type SignUpCompleted struct {
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
