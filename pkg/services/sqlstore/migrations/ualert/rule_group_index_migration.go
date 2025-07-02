package ualert

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// UpdateRuleGroupIndexMigration updates a new field rule_group_index for alert rules that belong to a group with more than 1 alert.
func UpdateRuleGroupIndexMigration(mg *migrator.Migrator) {
	mg.AddMigration("update group index for alert rules", &updateRulesOrderInGroup{})
}

type updateRulesOrderInGroup struct {
	migrator.MigrationBase
}

func (c updateRulesOrderInGroup) SQL(migrator.Dialect) string {
	return codeMigration
}

func (c updateRulesOrderInGroup) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	var rows []*alertRule
	if err := sess.Table(alertRule{}).Asc("id").Find(&rows); err != nil {
		return fmt.Errorf("failed to read the list of alert rules: %w", err)
	}

	if len(rows) == 0 {
		migrator.Logger.Debug("No rules to migrate.")
		return nil
	}

	groups := map[ngmodels.AlertRuleGroupKey][]*alertRule{}

	for _, row := range rows {
		groupKey := ngmodels.AlertRuleGroupKey{
			OrgID:        row.OrgID,
			NamespaceUID: row.NamespaceUID,
			RuleGroup:    row.RuleGroup,
		}
		groups[groupKey] = append(groups[groupKey], row)
	}

	toUpdate := make([]*alertRule, 0, len(rows))

	for _, rules := range groups {
		for i, rule := range rules {
			if rule.RuleGroupIndex == i+1 {
				continue
			}
			rule.RuleGroupIndex = i + 1
			toUpdate = append(toUpdate, rule)
		}
	}

	if len(toUpdate) == 0 {
		migrator.Logger.Debug("No rules to upgrade group index")
		return nil
	}

	updated := time.Now()
	versions := make([]interface{}, 0, len(toUpdate))

	for _, rule := range toUpdate {
		rule.Updated = updated
		version := rule.makeVersion()
		version.Version = rule.Version + 1
		version.ParentVersion = rule.Version
		rule.Version++
		_, err := sess.ID(rule.ID).Cols("version", "updated", "rule_group_idx").Update(rule)
		if err != nil {
			migrator.Logger.Error("failed to update alert rule", "uid", rule.UID, "err", err)
			return fmt.Errorf("unable to update alert rules with group index: %w", err)
		}
		migrator.Logger.Debug("updated group index for alert rule", "rule_uid", rule.UID)
		versions = append(versions, version)
	}
	_, err := sess.Insert(versions...)
	if err != nil {
		migrator.Logger.Error("failed to insert changes to alert_rule_version", "err", err)
		return fmt.Errorf("unable to update alert rules with group index: %w", err)
	}
	return nil
}

type alertRule struct {
	ID              int64 `xorm:"pk autoincr 'id'"`
	OrgID           int64 `xorm:"org_id"`
	Title           string
	Condition       string
	Data            []alertQuery
	IntervalSeconds int64
	Version         int64
	UID             string `xorm:"uid"`
	NamespaceUID    string `xorm:"namespace_uid"`
	RuleGroup       string
	RuleGroupIndex  int `xorm:"rule_group_idx"`
	NoDataState     string
	ExecErrState    string
	For             duration
	Updated         time.Time
	Annotations     map[string]string
	Labels          map[string]string
	IsPaused        bool
}

type alertRuleVersion struct {
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
	Data            []alertQuery
	IntervalSeconds int64
	NoDataState     string
	ExecErrState    string
	// ideally this field should have been apimodels.ApiDuration
	// but this is currently not possible because of circular dependencies
	For         duration
	Annotations map[string]string
	Labels      map[string]string
	IsPaused    bool
}

func (a *alertRule) makeVersion() *alertRuleVersion {
	return &alertRuleVersion{
		RuleOrgID:        a.OrgID,
		RuleUID:          a.UID,
		RuleNamespaceUID: a.NamespaceUID,
		RuleGroup:        a.RuleGroup,
		RuleGroupIndex:   a.RuleGroupIndex,
		ParentVersion:    0,
		RestoredFrom:     0,
		Version:          1,

		Created:         time.Now().UTC(),
		Title:           a.Title,
		Condition:       a.Condition,
		Data:            a.Data,
		IntervalSeconds: a.IntervalSeconds,
		NoDataState:     a.NoDataState,
		ExecErrState:    a.ExecErrState,
		For:             a.For,
		Annotations:     a.Annotations,
		Labels:          map[string]string{},
		IsPaused:        a.IsPaused,
	}
}

type alertQuery struct {
	// RefID is the unique identifier of the query, set by the frontend call.
	RefID string `json:"refId"`

	// QueryType is an optional identifier for the type of query.
	// It can be used to distinguish different types of queries.
	QueryType string `json:"queryType"`

	// RelativeTimeRange is the relative Start and End of the query as sent by the frontend.
	RelativeTimeRange relativeTimeRange `json:"relativeTimeRange"`

	DatasourceUID string `json:"datasourceUid"`

	// JSON is the raw JSON query and includes the above properties as well as custom properties.
	Model json.RawMessage `json:"model"`
}

// RelativeTimeRange is the per query start and end time
// for requests.
type relativeTimeRange struct {
	From duration `json:"from"`
	To   duration `json:"to"`
}

// duration is a type used for marshalling durations.
type duration time.Duration

func (d duration) String() string {
	return time.Duration(d).String()
}

func (d duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Duration(d).Seconds())
}

func (d *duration) UnmarshalJSON(b []byte) error {
	var v interface{}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	switch value := v.(type) {
	case float64:
		*d = duration(time.Duration(value) * time.Second)
		return nil
	default:
		return fmt.Errorf("invalid duration %v", v)
	}
}
