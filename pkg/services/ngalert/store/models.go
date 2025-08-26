package store

import "time"

// alertRule represents a record in alert_rule table
type alertRule struct {
	ID                          int64  `xorm:"pk autoincr 'id'"`
	GUID                        string `xorm:"guid"`
	OrgID                       int64  `xorm:"org_id"`
	Title                       string
	Condition                   string
	Data                        string
	Updated                     time.Time
	UpdatedBy                   *string `xorm:"updated_by"`
	IntervalSeconds             int64
	Version                     int64   `xorm:"version"` // this tag makes xorm add optimistic lock (see https://xorm.io/docs/chapter-06/1.lock/)
	UID                         string  `xorm:"uid"`
	NamespaceUID                string  `xorm:"namespace_uid"`
	DashboardUID                *string `xorm:"dashboard_uid"`
	PanelID                     *int64  `xorm:"panel_id"`
	RuleGroup                   string
	RuleGroupIndex              int    `xorm:"rule_group_idx"`
	Record                      string // FIXME: record is nullable but we don't save it as null when it's nil
	NoDataState                 string
	ExecErrState                string
	For                         time.Duration
	KeepFiringFor               time.Duration
	Annotations                 string
	Labels                      string
	IsPaused                    bool
	NotificationSettings        string `xorm:"notification_settings"`
	Metadata                    string `xorm:"metadata"`
	MissingSeriesEvalsToResolve *int64 `xorm:"missing_series_evals_to_resolve"`
}

func (a alertRule) TableName() string {
	return "alert_rule"
}

// alertRuleVersion represents a record in alert_rule_version table
type alertRuleVersion struct {
	ID               int64  `xorm:"pk autoincr 'id'"`
	RuleOrgID        int64  `xorm:"rule_org_id"`
	RuleGUID         string `xorm:"rule_guid"`
	RuleUID          string `xorm:"rule_uid"`
	RuleNamespaceUID string `xorm:"rule_namespace_uid"`
	RuleGroup        string
	RuleGroupIndex   int `xorm:"rule_group_idx"`
	ParentVersion    int64
	RestoredFrom     int64
	Version          int64

	Created         time.Time
	CreatedBy       *string `xorm:"created_by"`
	Title           string
	Condition       string
	Data            string
	IntervalSeconds int64
	Record          string
	NoDataState     string
	ExecErrState    string
	// ideally this field should have been apimodels.ApiDuration
	// but this is currently not possible because of circular dependencies
	For                         time.Duration
	KeepFiringFor               time.Duration
	Annotations                 string
	Labels                      string
	IsPaused                    bool
	NotificationSettings        string `xorm:"notification_settings"`
	Metadata                    string `xorm:"metadata"`
	MissingSeriesEvalsToResolve *int64 `xorm:"missing_series_evals_to_resolve"`
}

// EqualSpec compares two alertRuleVersion objects for equality based on their specifications and returns true if they match.
// The comparison is very basic and can produce false-negative. Fields excluded: ID, ParentVersion, RestoredFrom, Version, Created, RuleGroupIndex and CreatedBy
func (a alertRuleVersion) EqualSpec(b alertRuleVersion) bool {
	return a.RuleOrgID == b.RuleOrgID &&
		a.RuleGUID == b.RuleGUID &&
		a.RuleUID == b.RuleUID &&
		a.RuleNamespaceUID == b.RuleNamespaceUID &&
		a.RuleGroup == b.RuleGroup &&
		a.Title == b.Title &&
		a.Condition == b.Condition &&
		a.Data == b.Data &&
		a.IntervalSeconds == b.IntervalSeconds &&
		a.Record == b.Record &&
		a.NoDataState == b.NoDataState &&
		a.ExecErrState == b.ExecErrState &&
		a.For == b.For &&
		a.Annotations == b.Annotations &&
		a.Labels == b.Labels &&
		a.IsPaused == b.IsPaused &&
		a.NotificationSettings == b.NotificationSettings &&
		a.Metadata == b.Metadata &&
		a.MissingSeriesEvalsToResolve == b.MissingSeriesEvalsToResolve
}

func (a alertRuleVersion) TableName() string {
	return "alert_rule_version"
}
