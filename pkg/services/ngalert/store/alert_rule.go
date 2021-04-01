package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/dashboards"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

// AlertRuleMaxTitleLength is the maximum length of the alert rule title
const AlertRuleMaxTitleLength = 190

// AlertRuleMaxRuleGroupNameLength is the maximum length of the alert rule group name
const AlertRuleMaxRuleGroupNameLength = 190

type UpdateRuleGroupCmd struct {
	OrgID           int64
	NamespaceUID    string
	RuleGroupConfig apimodels.PostableRuleGroupConfig
}

type UpsertRule struct {
	Existing *ngmodels.AlertRule
	New      ngmodels.AlertRule
}

// Store is the interface for persisting alert rules and instances
type RuleStore interface {
	DeleteAlertRuleByUID(orgID int64, ruleUID string) error
	DeleteNamespaceAlertRules(orgID int64, namespaceUID string) error
	DeleteRuleGroupAlertRules(orgID int64, namespaceUID string, ruleGroup string) error
	GetAlertRuleByUID(*ngmodels.GetAlertRuleByUIDQuery) error
	GetAlertRulesForScheduling(query *ngmodels.ListAlertRulesQuery) error
	GetOrgAlertRules(query *ngmodels.ListAlertRulesQuery) error
	GetNamespaceAlertRules(query *ngmodels.ListNamespaceAlertRulesQuery) error
	GetRuleGroupAlertRules(query *ngmodels.ListRuleGroupAlertRulesQuery) error
	GetNamespaceUIDBySlug(string, int64, *models.SignedInUser) (string, error)
	GetNamespaceByUID(string, int64, *models.SignedInUser) (string, error)
	UpsertAlertRules([]UpsertRule) error
	UpdateRuleGroup(UpdateRuleGroupCmd) error
	GetAlertInstance(*ngmodels.GetAlertInstanceQuery) error
	ListAlertInstances(cmd *ngmodels.ListAlertInstancesQuery) error
	SaveAlertInstance(cmd *ngmodels.SaveAlertInstanceCommand) error
	ValidateAlertRule(ngmodels.AlertRule, bool) error
}

func getAlertRuleByUID(sess *sqlstore.DBSession, alertRuleUID string, orgID int64) (*ngmodels.AlertRule, error) {
	// we consider optionally enabling some caching
	alertRule := ngmodels.AlertRule{OrgID: orgID, UID: alertRuleUID}
	has, err := sess.Get(&alertRule)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, ngmodels.ErrAlertRuleNotFound
	}
	return &alertRule, nil
}

// DeleteAlertRuleByUID is a handler for deleting an alert rule.
// It returns ngmodels.ErrAlertRuleNotFound if no alert rule is found for the provided ID.
func (st DBstore) DeleteAlertRuleByUID(orgID int64, ruleUID string) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM alert_rule WHERE org_id = ? AND uid = ?", orgID, ruleUID)
		if err != nil {
			return err
		}

		_, err = sess.Exec("DELETE FROM alert_rule_version WHERE rule_org_id = ? and rule_uid = ?", orgID, ruleUID)

		if err != nil {
			return err
		}

		_, err = sess.Exec("DELETE FROM alert_instance WHERE def_org_id = ? AND def_uid = ?", orgID, ruleUID)
		if err != nil {
			return err
		}
		return nil
	})
}

// DeleteNamespaceAlertRules is a handler for deleting namespace alert rules.
func (st DBstore) DeleteNamespaceAlertRules(orgID int64, namespaceUID string) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if _, err := sess.Exec("DELETE FROM alert_rule WHERE org_id = ? and namespace_uid = ?", orgID, namespaceUID); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_rule_version WHERE rule_org_id = ? and rule_namespace_uid = ?", orgID, namespaceUID); err != nil {
			return err
		}

		if _, err := sess.Exec(`DELETE FROM alert_instance WHERE def_org_id = ? AND def_uid NOT IN (
			SELECT uid FROM alert_rule where org_id = ?
		)`, orgID, orgID); err != nil {
			return err
		}

		return nil
	})
}

// DeleteRuleGroupAlertRules is a handler for deleting rule group alert rules.
func (st DBstore) DeleteRuleGroupAlertRules(orgID int64, namespaceUID string, ruleGroup string) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if _, err := sess.Exec("DELETE FROM alert_rule WHERE org_id = ? and namespace_uid = ? and rule_group = ?", orgID, namespaceUID, ruleGroup); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_rule_version WHERE rule_org_id = ? and rule_namespace_uid = ? and rule_group = ?", orgID, namespaceUID, ruleGroup); err != nil {
			return err
		}

		if _, err := sess.Exec(`DELETE FROM alert_instance WHERE def_org_id = ? AND def_uid NOT IN (
			SELECT uid FROM alert_rule where org_id = ?
		)`, orgID, orgID); err != nil {
			return err
		}

		return nil
	})
}

// GetAlertRuleByUID is a handler for retrieving an alert rule from that database by its UID and organisation ID.
// It returns ngmodels.ErrAlertRuleNotFound if no alert rule is found for the provided ID.
func (st DBstore) GetAlertRuleByUID(query *ngmodels.GetAlertRuleByUIDQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertRule, err := getAlertRuleByUID(sess, query.UID, query.OrgID)
		if err != nil {
			return err
		}
		query.Result = alertRule
		return nil
	})
}

// UpsertAlertRules is a handler for creating/updating alert rules.
func (st DBstore) UpsertAlertRules(rules []UpsertRule) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		newRules := make([]ngmodels.AlertRule, 0, len(rules))
		ruleVersions := make([]ngmodels.AlertRuleVersion, 0, len(rules))
		for _, r := range rules {
			if r.Existing == nil && r.New.UID != "" {
				// check by UID
				existingAlertRule, err := getAlertRuleByUID(sess, r.New.UID, r.New.OrgID)
				if err != nil {
					if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
						return nil
					}
					return err
				}
				r.Existing = existingAlertRule
			}

			var parentVersion int64
			switch r.Existing {
			case nil: // new rule
				uid, err := generateNewAlertRuleUID(sess, r.New.OrgID)
				if err != nil {
					return fmt.Errorf("failed to generate UID for alert rule %q: %w", r.New.Title, err)
				}
				r.New.UID = uid

				if r.New.IntervalSeconds == 0 {
					r.New.IntervalSeconds = st.DefaultIntervalSeconds
				}

				r.New.Version = 1

				if err := st.ValidateAlertRule(r.New, true); err != nil {
					return err
				}

				if err := (&r.New).PreSave(TimeNow); err != nil {
					return err
				}

				newRules = append(newRules, r.New)
			default:
				// explicitly set the existing properties if missing
				// do not rely on xorm
				if r.New.Title == "" {
					r.New.Title = r.Existing.Title
				}

				if r.New.Condition == "" {
					r.New.Condition = r.Existing.Condition
				}

				if len(r.New.Data) == 0 {
					r.New.Data = r.Existing.Data
				}

				if r.New.IntervalSeconds == 0 {
					r.New.IntervalSeconds = r.Existing.IntervalSeconds
				}

				r.New.ID = r.Existing.ID
				r.New.OrgID = r.Existing.OrgID
				r.New.NamespaceUID = r.Existing.NamespaceUID
				r.New.RuleGroup = r.Existing.RuleGroup
				r.New.Version = r.Existing.Version + 1

				if err := st.ValidateAlertRule(r.New, true); err != nil {
					return err
				}

				if err := (&r.New).PreSave(TimeNow); err != nil {
					return err
				}

				// no way to update multiple rules at once
				if _, err := sess.ID(r.Existing.ID).Update(r.New); err != nil {
					return fmt.Errorf("failed to update rule %s: %w", r.New.Title, err)
				}

				parentVersion = r.Existing.Version
			}

			ruleVersions = append(ruleVersions, ngmodels.AlertRuleVersion{
				RuleOrgID:        r.New.OrgID,
				RuleUID:          r.New.UID,
				RuleNamespaceUID: r.New.NamespaceUID,
				RuleGroup:        r.New.RuleGroup,
				ParentVersion:    parentVersion,
				Version:          r.New.Version,
				Created:          r.New.Updated,
				Condition:        r.New.Condition,
				Title:            r.New.Title,
				Data:             r.New.Data,
				IntervalSeconds:  r.New.IntervalSeconds,
				NoDataState:      r.New.NoDataState,
				ExecErrState:     r.New.ExecErrState,
			})
		}

		if len(newRules) > 0 {
			if _, err := sess.Insert(&newRules); err != nil {
				return fmt.Errorf("failed to create new rules: %w", err)
			}
		}

		if len(ruleVersions) > 0 {
			if _, err := sess.Insert(&ruleVersions); err != nil {
				return fmt.Errorf("failed to create new rule versions: %w", err)
			}
		}

		return nil
	})
}

// GetOrgAlertRules is a handler for retrieving alert rules of specific organisation.
func (st DBstore) GetOrgAlertRules(query *ngmodels.ListAlertRulesQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertRules := make([]*ngmodels.AlertRule, 0)
		q := "SELECT * FROM alert_rule WHERE org_id = ?"
		if err := sess.SQL(q, query.OrgID).Find(&alertRules); err != nil {
			return err
		}

		query.Result = alertRules
		return nil
	})
}

// GetNamespaceAlertRules is a handler for retrieving namespace alert rules of specific organisation.
func (st DBstore) GetNamespaceAlertRules(query *ngmodels.ListNamespaceAlertRulesQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertRules := make([]*ngmodels.AlertRule, 0)
		// TODO rewrite using group by namespace_uid, rule_group
		q := "SELECT * FROM alert_rule WHERE org_id = ? and namespace_uid = ?"
		if err := sess.SQL(q, query.OrgID, query.NamespaceUID).Find(&alertRules); err != nil {
			return err
		}

		query.Result = alertRules
		return nil
	})
}

// GetRuleGroupAlertRules is a handler for retrieving rule group alert rules of specific organisation.
func (st DBstore) GetRuleGroupAlertRules(query *ngmodels.ListRuleGroupAlertRulesQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertRules := make([]*ngmodels.AlertRule, 0)
		q := "SELECT * FROM alert_rule WHERE org_id = ? and namespace_uid = ? and rule_group = ?"
		if err := sess.SQL(q, query.OrgID, query.NamespaceUID, query.RuleGroup).Find(&alertRules); err != nil {
			return err
		}

		query.Result = alertRules
		return nil
	})
}

// GetNamespaceUIDBySlug is a handler for retrieving namespace UID by its name.
func (st DBstore) GetNamespaceUIDBySlug(namespace string, orgID int64, user *models.SignedInUser) (string, error) {
	s := dashboards.NewFolderService(orgID, user, st.SQLStore)
	folder, err := s.GetFolderBySlug(namespace)
	if err != nil {
		return "", err
	}
	return folder.Uid, nil
}

// GetNamespaceByUID is a handler for retrieving namespace by its UID.
func (st DBstore) GetNamespaceByUID(UID string, orgID int64, user *models.SignedInUser) (string, error) {
	s := dashboards.NewFolderService(orgID, user, st.SQLStore)
	folder, err := s.GetFolderByUID(UID)
	if err != nil {
		return "", err
	}
	return folder.Title, nil
}

// GetAlertRulesForScheduling returns alert rule info (identifier, interval, version state)
// that is useful for it's scheduling.
func (st DBstore) GetAlertRulesForScheduling(query *ngmodels.ListAlertRulesQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alerts := make([]*ngmodels.AlertRule, 0)
		q := "SELECT uid, org_id, interval_seconds, version FROM alert_rule"
		if err := sess.SQL(q).Find(&alerts); err != nil {
			return err
		}

		query.Result = alerts
		return nil
	})
}

func generateNewAlertRuleUID(sess *sqlstore.DBSession, orgID int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&ngmodels.AlertRule{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", ngmodels.ErrAlertRuleFailedGenerateUniqueUID
}

// ValidateAlertRule validates the alert rule interval and organisation.
// If requireData is true checks that it contains at least one alert query
func (st DBstore) ValidateAlertRule(alertRule ngmodels.AlertRule, requireData bool) error {
	if !requireData && len(alertRule.Data) == 0 {
		return fmt.Errorf("no queries or expressions are found")
	}

	if alertRule.Title == "" {
		return ErrEmptyTitleError
	}

	if alertRule.IntervalSeconds%int64(st.BaseInterval.Seconds()) != 0 {
		return fmt.Errorf("invalid interval: %v: interval should be divided exactly by scheduler interval: %v", time.Duration(alertRule.IntervalSeconds)*time.Second, st.BaseInterval)
	}

	// enfore max name length in SQLite
	if len(alertRule.Title) > AlertRuleMaxTitleLength {
		return fmt.Errorf("name length should not be greater than %d", AlertRuleMaxTitleLength)
	}

	// enfore max name length in SQLite
	if len(alertRule.RuleGroup) > AlertRuleMaxRuleGroupNameLength {
		return fmt.Errorf("name length should not be greater than %d", AlertRuleMaxRuleGroupNameLength)
	}

	if alertRule.OrgID == 0 {
		return fmt.Errorf("no organisation is found")
	}

	return nil
}

// UpdateRuleGroup creates new rules and updates and/or deletes existing rules
func (st DBstore) UpdateRuleGroup(cmd UpdateRuleGroupCmd) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		ruleGroup := cmd.RuleGroupConfig.Name
		q := &ngmodels.ListRuleGroupAlertRulesQuery{
			OrgID:        cmd.OrgID,
			NamespaceUID: cmd.NamespaceUID,
			RuleGroup:    ruleGroup,
		}
		if err := st.GetRuleGroupAlertRules(q); err != nil {
			return err
		}
		existingGroupRules := q.Result

		existingGroupRulesUIDs := make(map[string]ngmodels.AlertRule, len(existingGroupRules))
		for _, r := range existingGroupRules {
			existingGroupRulesUIDs[r.UID] = *r
		}

		upsertRules := make([]UpsertRule, 0)
		for _, r := range cmd.RuleGroupConfig.Rules {
			if r.GrafanaManagedAlert == nil {
				continue
			}

			upsertRule := UpsertRule{
				New: ngmodels.AlertRule{
					OrgID:           cmd.OrgID,
					Title:           r.GrafanaManagedAlert.Title,
					Condition:       r.GrafanaManagedAlert.Condition,
					Data:            r.GrafanaManagedAlert.Data,
					UID:             r.GrafanaManagedAlert.UID,
					IntervalSeconds: int64(time.Duration(cmd.RuleGroupConfig.Interval).Seconds()),
					NamespaceUID:    cmd.NamespaceUID,
					RuleGroup:       ruleGroup,
					NoDataState:     ngmodels.NoDataState(r.GrafanaManagedAlert.NoDataState),
					ExecErrState:    ngmodels.ExecutionErrorState(r.GrafanaManagedAlert.ExecErrState),
				},
			}

			if existingGroupRule, ok := existingGroupRulesUIDs[r.GrafanaManagedAlert.UID]; ok {
				upsertRule.Existing = &existingGroupRule
				// remove the rule from existingGroupRulesUIDs
				delete(existingGroupRulesUIDs, r.GrafanaManagedAlert.UID)
			}
			upsertRules = append(upsertRules, upsertRule)
		}

		if err := st.UpsertAlertRules(upsertRules); err != nil {
			return err
		}

		// delete the remaining rules
		for ruleUID := range existingGroupRulesUIDs {
			if err := st.DeleteAlertRuleByUID(cmd.OrgID, ruleUID); err != nil {
				return err
			}
		}
		return nil
	})
}
