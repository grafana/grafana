package models

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrAlertNotificationNotFound                = errors.New("alert notification not found")
	ErrNotificationFrequencyNotFound            = errors.New("notification frequency not specified")
	ErrAlertNotificationStateVersionConflict    = errors.New("alert notification state update version conflict")
	ErrAlertNotificationFailedGenerateUniqueUid = errors.New("failed to generate unique alert notification uid")
	ErrAlertNotificationFailedTranslateUniqueID = errors.New("failed to translate Notification Id to Uid")
	ErrAlertNotificationWithSameNameExists      = errors.New("alert notification with same name already exists")
	ErrAlertNotificationWithSameUIDExists       = errors.New("alert notification with same uid already exists")
)

type AlertNotificationStateType string

var (
	AlertNotificationStatePending   = AlertNotificationStateType("pending")
	AlertNotificationStateCompleted = AlertNotificationStateType("completed")
	AlertNotificationStateUnknown   = AlertNotificationStateType("unknown")
)

type AlertNotification struct {
	ID                    int64             `json:"id" xorm:"pk autoincr 'id'"`
	UID                   string            `json:"-" xorm:"uid"`
	OrgID                 int64             `json:"-" xorm:"org_id"`
	Name                  string            `json:"name"`
	Type                  string            `json:"type"`
	SendReminder          bool              `json:"sendReminder"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Frequency             time.Duration     `json:"frequency"`
	IsDefault             bool              `json:"isDefault"`
	Settings              *simplejson.Json  `json:"settings"`
	SecureSettings        map[string][]byte `json:"secureSettings"`
	Created               time.Time         `json:"created"`
	Updated               time.Time         `json:"updated"`
}

type CreateAlertNotificationCommand struct {
	UID                   string            `json:"uid"`
	Name                  string            `json:"name"  binding:"Required"`
	Type                  string            `json:"type"  binding:"Required"`
	SendReminder          bool              `json:"sendReminder"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Frequency             string            `json:"frequency"`
	IsDefault             bool              `json:"isDefault"`
	Settings              *simplejson.Json  `json:"settings"`
	SecureSettings        map[string]string `json:"secureSettings"`

	OrgID                   int64             `json:"-"`
	EncryptedSecureSettings map[string][]byte `json:"-"`
}

type UpdateAlertNotificationCommand struct {
	ID                    int64             `json:"id"  binding:"Required"`
	UID                   string            `json:"uid"`
	Name                  string            `json:"name"  binding:"Required"`
	Type                  string            `json:"type"  binding:"Required"`
	SendReminder          bool              `json:"sendReminder"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Frequency             string            `json:"frequency"`
	IsDefault             bool              `json:"isDefault"`
	Settings              *simplejson.Json  `json:"settings"  binding:"Required"`
	SecureSettings        map[string]string `json:"secureSettings"`

	OrgID                   int64             `json:"-"`
	EncryptedSecureSettings map[string][]byte `json:"-"`
}

type UpdateAlertNotificationWithUidCommand struct {
	UID                   string            `json:"-"`
	NewUID                string            `json:"uid"`
	Name                  string            `json:"name"  binding:"Required"`
	Type                  string            `json:"type"  binding:"Required"`
	SendReminder          bool              `json:"sendReminder"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Frequency             string            `json:"frequency"`
	IsDefault             bool              `json:"isDefault"`
	Settings              *simplejson.Json  `json:"settings"  binding:"Required"`
	SecureSettings        map[string]string `json:"secureSettings"`

	OrgID int64 `json:"-"`
}

type DeleteAlertNotificationCommand struct {
	ID    int64
	OrgID int64
}
type DeleteAlertNotificationWithUidCommand struct {
	UID   string
	OrgID int64

	DeletedAlertNotificationID int64
}

type GetAlertNotificationUidQuery struct {
	ID    int64
	OrgID int64
}

type GetAlertNotificationsQuery struct {
	Name  string
	ID    int64
	OrgID int64
}

type GetAlertNotificationsWithUidQuery struct {
	UID   string
	OrgID int64
}

type GetAlertNotificationsWithUidToSendQuery struct {
	UIDs  []string
	OrgID int64
}

type GetAllAlertNotificationsQuery struct {
	OrgID int64
}

type AlertNotificationState struct {
	ID                           int64 `xorm:"pk autoincr 'id'"`
	OrgID                        int64 `xorm:"org_id"`
	AlertID                      int64 `xorm:"alert_id"`
	NotifierID                   int64 `xorm:"notifier_id"`
	State                        AlertNotificationStateType
	Version                      int64
	UpdatedAt                    int64
	AlertRuleStateUpdatedVersion int64
}

type SetAlertNotificationStateToPendingCommand struct {
	ID                           int64
	AlertRuleStateUpdatedVersion int64
	Version                      int64

	ResultVersion int64
}

type SetAlertNotificationStateToCompleteCommand struct {
	ID      int64
	Version int64
}

type GetOrCreateNotificationStateQuery struct {
	OrgID      int64
	AlertID    int64
	NotifierID int64
}
