package models

import (
	"sort"

	"github.com/prometheus/common/model"
	"golang.org/x/exp/slices"

	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// OrgMigrationState contains information about the state of an org migration.
type OrgMigrationState struct {
	OrgID              int64               `json:"orgId"`
	MigratedDashboards []*DashboardUpgrade `json:"migratedDashboards"`
	MigratedChannels   []*ContactPair      `json:"migratedChannels"`
	CreatedFolders     []string            `json:"createdFolders"`
	Errors             []string            `json:"errors"`
}

type DashboardUpgradeInfo struct {
	DashboardID   int64  `json:"dashboardId"`
	DashboardUID  string `json:"dashboardUid"`
	DashboardName string `json:"dashboardName"`
	FolderUID     string `json:"folderUid"`
	FolderName    string `json:"folderName"`
	NewFolderUID  string `json:"newFolderUid,omitempty"`
	NewFolderName string `json:"newFolderName,omitempty"`
	Provisioned   bool   `json:"provisioned"`
}

type DashboardUpgrade struct {
	*DashboardUpgradeInfo `json:",inline"`
	MigratedAlerts        []*AlertPair `json:"migratedAlerts"`
	Errors                []string     `json:"errors"`
	Warnings              []string     `json:"warnings"`

	NewAlertCount int `json:"-"`
}

type AlertPair struct {
	LegacyAlert *LegacyAlert      `json:"legacyAlert"`
	AlertRule   *AlertRuleUpgrade `json:"alertRule"`
	Error       string            `json:"error,omitempty"`

	alertRule ngmodels.AlertRule
}

type ContactPair struct {
	LegacyChannel       *LegacyChannel       `json:"legacyChannel"`
	ContactPointUpgrade *ContactPointUpgrade `json:"contactPoint"`
	Provisioned         bool                 `json:"provisioned"`
	Error               string               `json:"error,omitempty"`
}

type LegacyAlert struct {
	ID             int64          `json:"id"`
	DashboardID    int64          `json:"dashboardId"`
	PanelID        int64          `json:"panelId"`
	Name           string         `json:"name"`
	Paused         bool           `json:"paused"`
	Silenced       bool           `json:"silenced"`
	ExecutionError string         `json:"executionError"`
	Frequency      int64          `json:"frequency"`
	For            model.Duration `json:"for"`

	Modified bool `json:"modified"`
}

type AlertRuleUpgrade struct {
	UID          string                       `json:"uid"`
	Title        string                       `json:"title"`
	DashboardUID *string                      `json:"dashboardUid"`
	PanelID      *int64                       `json:"panelId"`
	NoDataState  ngmodels.NoDataState         `json:"noDataState"`
	ExecErrState ngmodels.ExecutionErrorState `json:"execErrState"`
	For          model.Duration               `json:"for"`
	Annotations  map[string]string            `json:"annotations"`
	Labels       map[string]string            `json:"labels"`
	IsPaused     bool                         `json:"isPaused"`

	Modified bool `json:"modified"`
}

type LegacyChannel struct {
	ID                    int64          `json:"id"`
	UID                   string         `json:"uid"`
	Name                  string         `json:"name"`
	Type                  string         `json:"type"`
	SendReminder          bool           `json:"sendReminder"`
	DisableResolveMessage bool           `json:"disableResolveMessage"`
	Frequency             model.Duration `json:"frequency"`
	IsDefault             bool           `json:"isDefault"`
	Modified              bool           `json:"modified"`
}

type ContactPointUpgrade struct {
	Name                  string `json:"name"`
	UID                   string `json:"uid"`
	Type                  string `json:"type"`
	DisableResolveMessage bool   `json:"disableResolveMessage"`

	RouteLabel string `json:"routeLabel"`
	Modified   bool   `json:"modified"`
}

func (oms *OrgMigrationState) NestedErrors() []string {
	var allErrors []string

	// Errors such as failure to persist or load from database.
	allErrors = append(allErrors, oms.Errors...)

	for _, du := range oms.MigratedDashboards {
		// Currently unused, but here for future use.
		allErrors = append(allErrors, du.Errors...)
		for _, pair := range du.MigratedAlerts {
			if pair.Error != "" {
				// All issues with migrating alerts, such as: failure to find dashboard, folder, or issues when creating new folder.
				allErrors = append(allErrors, pair.Error)
			}
		}
	}

	// Holds issues with creating new contact points or routes. Mostly discontinued channel types (hipmunk, sensu).
	for _, pair := range oms.MigratedChannels {
		if pair.Error != "" {
			allErrors = append(allErrors, pair.Error)
		}
	}

	sort.Strings(allErrors)
	return slices.Compact(allErrors)
}

func (oms *OrgMigrationState) AddDashboardUpgrade(du *DashboardUpgrade) {
	if du != nil {
		oms.MigratedDashboards = append(oms.MigratedDashboards, du)
	}
}

func (oms *OrgMigrationState) GetDashboardUpgrade(dashboardId int64) *DashboardUpgrade {
	for _, du := range oms.MigratedDashboards {
		if du.DashboardID == dashboardId {
			return du
		}
	}
	return nil
}

func (oms *OrgMigrationState) PopDashboardUpgrade(dashboardId int64) *DashboardUpgrade {
	for i, du := range oms.MigratedDashboards {
		if du.DashboardID == dashboardId {
			oms.MigratedDashboards = append(oms.MigratedDashboards[:i], oms.MigratedDashboards[i+1:]...)
			return du
		}
	}
	return nil
}

func (oms *OrgMigrationState) ExcludeExisting(channels ...*legacymodels.AlertNotification) []*legacymodels.AlertNotification {
	channelUidMap := make(map[string]*ContactPair)
	for _, pair := range oms.MigratedChannels {
		channelUidMap[pair.LegacyChannel.UID] = pair
	}
	var newChannels []*legacymodels.AlertNotification
	for _, c := range channels {
		if _, ok := channelUidMap[c.UID]; !ok {
			newChannels = append(newChannels, c)
		}
	}

	return newChannels
}

func (oms *OrgMigrationState) PopContactPair(id int64) *ContactPair {
	for i, pair := range oms.MigratedChannels {
		if pair.LegacyChannel.ID == id {
			oms.MigratedChannels = append(oms.MigratedChannels[:i], oms.MigratedChannels[i+1:]...)
			return pair
		}
	}
	return nil
}

func (oms *OrgMigrationState) AddError(err string) {
	// Ensure we don't add the same error twice. There shouldn't be many, so a simple loop is fine.
	for _, e := range oms.Errors {
		if e == err {
			return
		}
	}
	oms.Errors = append(oms.Errors, err)
}

func (du *DashboardUpgrade) PopAlertPair(panelId int64) *AlertPair {
	for i, pair := range du.MigratedAlerts {
		if pair.LegacyAlert.PanelID == panelId {
			du.MigratedAlerts = append(du.MigratedAlerts[:i], du.MigratedAlerts[i+1:]...)
			return pair
		}
	}
	return nil
}

func (du *DashboardUpgrade) ExcludeExisting(alerts ...*legacymodels.Alert) []*legacymodels.Alert {
	idMap := make(map[int64]*AlertPair)
	for _, pair := range du.MigratedAlerts {
		idMap[pair.LegacyAlert.PanelID] = pair
	}
	var newAlerts []*legacymodels.Alert
	for _, da := range alerts {
		if _, ok := idMap[da.PanelID]; !ok {
			newAlerts = append(newAlerts, da)
		}
	}

	return newAlerts
}

func (du *DashboardUpgrade) SetDashboard(uid, name string) {
	du.DashboardUID = uid
	du.DashboardName = name
}
func (du *DashboardUpgrade) SetFolder(uid, name string) {
	du.FolderUID = uid
	du.FolderName = name
}
func (du *DashboardUpgrade) SetNewFolder(uid, name string) {
	du.NewFolderUID = uid
	du.NewFolderName = name
}

func NewAlertPair(da *legacymodels.Alert, err error) *AlertPair {
	pair := &AlertPair{
		LegacyAlert: &LegacyAlert{
			Modified:       false,
			ID:             da.ID,
			DashboardID:    da.DashboardID,
			PanelID:        da.PanelID,
			Name:           da.Name,
			Paused:         da.State == legacymodels.AlertStatePaused,
			Silenced:       da.Silenced,
			ExecutionError: da.ExecutionError,
			Frequency:      da.Frequency,
			For:            model.Duration(da.For),
		},
	}
	if err != nil {
		pair.Error = err.Error()
	}
	return pair
}

func (du *DashboardUpgrade) AddAlertErrors(err error, alerts ...*legacymodels.Alert) []*AlertPair {
	pairs := make([]*AlertPair, 0, len(alerts))
	for _, da := range alerts {
		pairs = append(pairs, NewAlertPair(da, err))
	}
	du.MigratedAlerts = append(du.MigratedAlerts, pairs...)

	return pairs
}

func (du *DashboardUpgrade) AddWarning(warning string) {
	// Ensure we don't add the same warning twice. There shouldn't be many warnings, so a simple loop is fine.
	for _, w := range du.Warnings {
		if w == warning {
			return
		}
	}
	du.Warnings = append(du.Warnings, warning)
}

func (pair *AlertPair) AttachAlertRule(rule ngmodels.AlertRule) {
	pair.AlertRule = &AlertRuleUpgrade{
		Modified:     false,
		UID:          rule.UID,
		Title:        rule.Title,
		DashboardUID: rule.DashboardUID,
		PanelID:      rule.PanelID,
		NoDataState:  rule.NoDataState,
		ExecErrState: rule.ExecErrState,
		For:          model.Duration(rule.For),
		Annotations:  rule.Annotations,
		Labels:       rule.Labels,
		IsPaused:     rule.IsPaused,
	}
	pair.alertRule = rule
}

func (pair *AlertPair) GetAlertRule() ngmodels.AlertRule {
	return pair.alertRule
}
