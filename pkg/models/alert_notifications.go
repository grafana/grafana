package models

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrNotificationFrequencyNotFound = errors.New("Notification frequency not specified")
	ErrJournalingNotFound            = errors.New("alert notification journaling not found")
)

type AlertNotification struct {
	Id           int64            `json:"id"`
	OrgId        int64            `json:"-"`
	Name         string           `json:"name"`
	Type         string           `json:"type"`
	SendReminder bool             `json:"sendReminder"`
	Frequency    time.Duration    `json:"frequency"`
	IsDefault    bool             `json:"isDefault"`
	Settings     *simplejson.Json `json:"settings"`
	Created      time.Time        `json:"created"`
	Updated      time.Time        `json:"updated"`
}

type CreateAlertNotificationCommand struct {
	Name         string           `json:"name"  binding:"Required"`
	Type         string           `json:"type"  binding:"Required"`
	SendReminder bool             `json:"sendReminder"`
	Frequency    string           `json:"frequency"`
	IsDefault    bool             `json:"isDefault"`
	Settings     *simplejson.Json `json:"settings"`

	OrgId  int64 `json:"-"`
	Result *AlertNotification
}

type UpdateAlertNotificationCommand struct {
	Id           int64            `json:"id"  binding:"Required"`
	Name         string           `json:"name"  binding:"Required"`
	Type         string           `json:"type"  binding:"Required"`
	SendReminder bool             `json:"sendReminder"`
	Frequency    string           `json:"frequency"`
	IsDefault    bool             `json:"isDefault"`
	Settings     *simplejson.Json `json:"settings"  binding:"Required"`

	OrgId  int64 `json:"-"`
	Result *AlertNotification
}

type DeleteAlertNotificationCommand struct {
	Id    int64
	OrgId int64
}

type GetAlertNotificationsQuery struct {
	Name  string
	Id    int64
	OrgId int64

	Result *AlertNotification
}

type GetAlertNotificationsToSendQuery struct {
	Ids   []int64
	OrgId int64

	Result []*AlertNotification
}

type GetAllAlertNotificationsQuery struct {
	OrgId int64

	Result []*AlertNotification
}

type AlertNotificationJournal struct {
	Id         int64
	OrgId      int64
	AlertId    int64
	NotifierId int64
	SentAt     int64
	Success    bool
}

type RecordNotificationJournalCommand struct {
	OrgId      int64
	AlertId    int64
	NotifierId int64
	SentAt     int64
	Success    bool
}

type GetLatestNotificationQuery struct {
	OrgId      int64
	AlertId    int64
	NotifierId int64

	Result *AlertNotificationJournal
}

type CleanNotificationJournalCommand struct {
	OrgId      int64
	AlertId    int64
	NotifierId int64
}
