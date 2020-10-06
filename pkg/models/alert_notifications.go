package models

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrAlertNotificationNotFound                = errors.New("Alert notification not found")
	ErrNotificationFrequencyNotFound            = errors.New("Notification frequency not specified")
	ErrAlertNotificationStateNotFound           = errors.New("alert notification state not found")
	ErrAlertNotificationStateVersionConflict    = errors.New("alert notification state update version conflict")
	ErrAlertNotificationStateAlreadyExist       = errors.New("alert notification state already exists")
	ErrAlertNotificationFailedGenerateUniqueUid = errors.New("Failed to generate unique alert notification uid")
)

type AlertNotificationStateType string

var (
	AlertNotificationStatePending   = AlertNotificationStateType("pending")
	AlertNotificationStateCompleted = AlertNotificationStateType("completed")
	AlertNotificationStateUnknown   = AlertNotificationStateType("unknown")
)

type AlertNotification struct {
	Id                    int64                         `json:"id"`
	Uid                   string                        `json:"-"`
	OrgId                 int64                         `json:"-"`
	Name                  string                        `json:"name"`
	Type                  string                        `json:"type"`
	SendReminder          bool                          `json:"sendReminder"`
	DisableResolveMessage bool                          `json:"disableResolveMessage"`
	Frequency             time.Duration                 `json:"frequency"`
	IsDefault             bool                          `json:"isDefault"`
	Settings              *simplejson.Json              `json:"settings"`
	SecureSettings        securejsondata.SecureJsonData `json:"secureSettings"`
	Created               time.Time                     `json:"created"`
	Updated               time.Time                     `json:"updated"`
}

type CreateAlertNotificationCommand struct {
	Uid                   string            `json:"uid"`
	Name                  string            `json:"name"  binding:"Required"`
	Type                  string            `json:"type"  binding:"Required"`
	SendReminder          bool              `json:"sendReminder"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Frequency             string            `json:"frequency"`
	IsDefault             bool              `json:"isDefault"`
	Settings              *simplejson.Json  `json:"settings"`
	SecureSettings        map[string]string `json:"secureSettings"`

	OrgId  int64 `json:"-"`
	Result *AlertNotification
}

type UpdateAlertNotificationCommand struct {
	Id                    int64             `json:"id"  binding:"Required"`
	Uid                   string            `json:"uid"`
	Name                  string            `json:"name"  binding:"Required"`
	Type                  string            `json:"type"  binding:"Required"`
	SendReminder          bool              `json:"sendReminder"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Frequency             string            `json:"frequency"`
	IsDefault             bool              `json:"isDefault"`
	Settings              *simplejson.Json  `json:"settings"  binding:"Required"`
	SecureSettings        map[string]string `json:"secureSettings"`

	OrgId  int64 `json:"-"`
	Result *AlertNotification
}

type UpdateAlertNotificationWithUidCommand struct {
	Uid                   string            `json:"-"`
	NewUid                string            `json:"uid"`
	Name                  string            `json:"name"  binding:"Required"`
	Type                  string            `json:"type"  binding:"Required"`
	SendReminder          bool              `json:"sendReminder"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Frequency             string            `json:"frequency"`
	IsDefault             bool              `json:"isDefault"`
	Settings              *simplejson.Json  `json:"settings"  binding:"Required"`
	SecureSettings        map[string]string `json:"secureSettings"`

	OrgId  int64
	Result *AlertNotification
}

type DeleteAlertNotificationCommand struct {
	Id    int64
	OrgId int64
}
type DeleteAlertNotificationWithUidCommand struct {
	Uid   string
	OrgId int64

	DeletedAlertNotificationId int64
}

type GetAlertNotificationUidQuery struct {
	Id    int64
	OrgId int64

	Result string
}

type GetAlertNotificationsQuery struct {
	Name  string
	Id    int64
	OrgId int64

	Result *AlertNotification
}

type GetAlertNotificationsWithUidQuery struct {
	Uid   string
	OrgId int64

	Result *AlertNotification
}

type GetAlertNotificationsWithUidToSendQuery struct {
	Uids  []string
	OrgId int64

	Result []*AlertNotification
}

type GetAllAlertNotificationsQuery struct {
	OrgId int64

	Result []*AlertNotification
}

type AlertNotificationState struct {
	Id                           int64
	OrgId                        int64
	AlertId                      int64
	NotifierId                   int64
	State                        AlertNotificationStateType
	Version                      int64
	UpdatedAt                    int64
	AlertRuleStateUpdatedVersion int64
}

type SetAlertNotificationStateToPendingCommand struct {
	Id                           int64
	AlertRuleStateUpdatedVersion int64
	Version                      int64

	ResultVersion int64
}

type SetAlertNotificationStateToCompleteCommand struct {
	Id      int64
	Version int64
}

type GetOrCreateNotificationStateQuery struct {
	OrgId      int64
	AlertId    int64
	NotifierId int64

	Result *AlertNotificationState
}

// decryptedValue returns decrypted value from secureSettings
func (an *AlertNotification) DecryptedValue(field string, fallback string) string {
	if value, ok := an.SecureSettings.DecryptedValue(field); ok {
		return value
	}
	return fallback
}
