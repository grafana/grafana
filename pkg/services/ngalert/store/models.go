package store

import "time"

// alertRule represents a record in alert_rule table
type alertRule struct {
	ID                   int64 `xorm:"pk autoincr 'id'"`
	OrgID                int64 `xorm:"org_id"`
	Title                string
	Condition            string
	Data                 string
	Updated              time.Time
	IntervalSeconds      int64
	Version              int64   `xorm:"version"` // this tag makes xorm add optimistic lock (see https://xorm.io/docs/chapter-06/1.lock/)
	UID                  string  `xorm:"uid"`
	NamespaceUID         string  `xorm:"namespace_uid"`
	DashboardUID         *string `xorm:"dashboard_uid"`
	PanelID              *int64  `xorm:"panel_id"`
	RuleGroup            string
	RuleGroupIndex       int `xorm:"rule_group_idx"`
	Record               string
	NoDataState          string
	ExecErrState         string
	For                  time.Duration
	Annotations          string
	Labels               string
	IsPaused             bool
	NotificationSettings string `xorm:"notification_settings"`
	Metadata             string `xorm:"metadata"`
}

func (a alertRule) TableName() string {
	return "alert_rule"
}

// alertRuleVersion represents a record in alert_rule_version table
type alertRuleVersion struct {
	ID               int64  `xorm:"pk autoincr 'id'"`
	RuleOrgID        int64  `xorm:"rule_org_id"`
	RuleUID          string `xorm:"rule_uid"`
	RuleNamespaceUID string `xorm:"rule_namespace_uid"`
	RuleGroup        string
	RuleGroupIndex   int `xorm:"rule_group_idx"`
	ParentVersion    int64
	RestoredFrom     int64
	Version          int64

	Created         time.Time
	Title           string
	Condition       string
	Data            string
	IntervalSeconds int64
	Record          string
	NoDataState     string
	ExecErrState    string
	// ideally this field should have been apimodels.ApiDuration
	// but this is currently not possible because of circular dependencies
	For                  time.Duration
	Annotations          string
	Labels               string
	IsPaused             bool
	NotificationSettings string `xorm:"notification_settings"`
	Metadata             string `xorm:"metadata"`
}

func (a alertRuleVersion) TableName() string {
	return "alert_rule_version"
}
