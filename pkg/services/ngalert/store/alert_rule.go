package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/guardian"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/dashboards"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
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
	DeleteNamespaceAlertRules(orgID int64, namespaceUID string) ([]string, error)
	DeleteRuleGroupAlertRules(orgID int64, namespaceUID string, ruleGroup string) ([]string, error)
	DeleteAlertInstancesByRuleUID(orgID int64, ruleUID string) error
	GetAlertRuleByUID(*ngmodels.GetAlertRuleByUIDQuery) error
	GetAlertRulesForScheduling(query *ngmodels.ListAlertRulesQuery) error
	GetOrgAlertRules(query *ngmodels.ListAlertRulesQuery) error
	GetNamespaceAlertRules(query *ngmodels.ListNamespaceAlertRulesQuery) error
	GetRuleGroupAlertRules(query *ngmodels.ListRuleGroupAlertRulesQuery) error
	GetNamespaceByTitle(string, int64, *models.SignedInUser, bool) (*models.Folder, error)
	GetNamespaceByUID(string, int64, *models.SignedInUser) (*models.Folder, error)
	GetOrgRuleGroups(query *ngmodels.ListOrgRuleGroupsQuery) error
	UpsertAlertRules([]UpsertRule) error
	UpdateRuleGroup(UpdateRuleGroupCmd) error
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

		_, err = sess.Exec("DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid = ?", orgID, ruleUID)
		if err != nil {
			return err
		}
		return nil
	})
}

// DeleteNamespaceAlertRules is a handler for deleting namespace alert rules. A list of deleted rule UIDs are returned.
func (st DBstore) DeleteNamespaceAlertRules(orgID int64, namespaceUID string) ([]string, error) {
	ruleUIDs := []string{}

	err := st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if err := sess.SQL("SELECT uid FROM alert_rule WHERE org_id = ? and namespace_uid = ?", orgID, namespaceUID).Find(&ruleUIDs); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_rule WHERE org_id = ? and namespace_uid = ?", orgID, namespaceUID); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_rule WHERE org_id = ? and namespace_uid = ?", orgID, namespaceUID); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_rule_version WHERE rule_org_id = ? and rule_namespace_uid = ?", orgID, namespaceUID); err != nil {
			return err
		}

		if _, err := sess.Exec(`DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid NOT IN (
			SELECT uid FROM alert_rule where org_id = ?
		)`, orgID, orgID); err != nil {
			return err
		}

		return nil
	})
	return ruleUIDs, err
}

// DeleteRuleGroupAlertRules is a handler for deleting rule group alert rules. A list of deleted rule UIDs are returned.
func (st DBstore) DeleteRuleGroupAlertRules(orgID int64, namespaceUID string, ruleGroup string) ([]string, error) {
	ruleUIDs := []string{}

	err := st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if err := sess.SQL("SELECT uid FROM alert_rule WHERE org_id = ? and namespace_uid = ? and rule_group = ?",
			orgID, namespaceUID, ruleGroup).Find(&ruleUIDs); err != nil {
			return err
		}
		exist, err := sess.Exist(&ngmodels.AlertRule{OrgID: orgID, NamespaceUID: namespaceUID, RuleGroup: ruleGroup})
		if err != nil {
			return err
		}

		if !exist {
			return ngmodels.ErrRuleGroupNamespaceNotFound
		}

		if _, err := sess.Exec("DELETE FROM alert_rule WHERE org_id = ? and namespace_uid = ? and rule_group = ?", orgID, namespaceUID, ruleGroup); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_rule_version WHERE rule_org_id = ? and rule_namespace_uid = ? and rule_group = ?", orgID, namespaceUID, ruleGroup); err != nil {
			return err
		}

		if _, err := sess.Exec(`DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid NOT IN (
			SELECT uid FROM alert_rule where org_id = ?
		)`, orgID, orgID); err != nil {
			return err
		}

		return nil
	})

	return ruleUIDs, err
}

// DeleteAlertInstanceByRuleUID is a handler for deleting alert instances by alert rule UID when a rule has been updated
func (st DBstore) DeleteAlertInstancesByRuleUID(orgID int64, ruleUID string) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid = ?", orgID, ruleUID)
		if err != nil {
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
						return fmt.Errorf("failed to get alert rule %s: %w", r.New.UID, err)
					}
					return err
				}
				r.Existing = existingAlertRule
			}

			var parentVersion int64
			switch r.Existing {
			case nil: // new rule
				uid, err := GenerateNewAlertRuleUID(sess, r.New.OrgID, r.New.Title)
				if err != nil {
					return fmt.Errorf("failed to generate UID for alert rule %q: %w", r.New.Title, err)
				}
				r.New.UID = uid

				if r.New.IntervalSeconds == 0 {
					r.New.IntervalSeconds = st.DefaultIntervalSeconds
				}

				r.New.Version = 1

				if r.New.NoDataState == "" {
					// set default no data state
					r.New.NoDataState = ngmodels.NoData
				}

				if r.New.ExecErrState == "" {
					// set default error state
					r.New.ExecErrState = ngmodels.AlertingErrState
				}

				if err := st.validateAlertRule(r.New); err != nil {
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

				if r.New.For == 0 {
					r.New.For = r.Existing.For
				}

				if len(r.New.Annotations) == 0 {
					r.New.Annotations = r.Existing.Annotations
				}

				if len(r.New.Labels) == 0 {
					r.New.Labels = r.Existing.Labels
				}

				if err := st.validateAlertRule(r.New); err != nil {
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
				For:              r.New.For,
				Annotations:      r.New.Annotations,
				Labels:           r.New.Labels,
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

// GetNamespaceByTitle is a handler for retrieving a namespace by its title. Alerting rules follow a Grafana folder-like structure which we call namespaces.
func (st DBstore) GetNamespaceByTitle(namespace string, orgID int64, user *models.SignedInUser, withCanSave bool) (*models.Folder, error) {
	s := dashboards.NewFolderService(orgID, user, st.SQLStore)
	folder, err := s.GetFolderByTitle(namespace)
	if err != nil {
		return nil, err
	}

	if withCanSave {
		g := guardian.New(folder.Id, orgID, user)
		if canSave, err := g.CanSave(); err != nil || !canSave {
			if err != nil {
				st.Logger.Error("checking can save permission has failed", "userId", user.UserId, "username", user.Login, "namespace", namespace, "orgId", orgID, "error", err)
			}
			return nil, ngmodels.ErrCannotEditNamespace
		}
	}

	return folder, nil
}

// GetNamespaceByUID is a handler for retrieving namespace by its UID.
func (st DBstore) GetNamespaceByUID(UID string, orgID int64, user *models.SignedInUser) (*models.Folder, error) {
	s := dashboards.NewFolderService(orgID, user, st.SQLStore)
	folder, err := s.GetFolderByUID(UID)
	if err != nil {
		return nil, err
	}

	return folder, nil
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

// GenerateNewAlertRuleUID generates a unique UID for a rule.
// This is set as a variable so that the tests can override it.
// The ruleTitle is only used by the mocked functions.
var GenerateNewAlertRuleUID = func(sess *sqlstore.DBSession, orgID int64, ruleTitle string) (string, error) {
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

// validateAlertRule validates the alert rule interval and organisation.
func (st DBstore) validateAlertRule(alertRule ngmodels.AlertRule) error {
	if len(alertRule.Data) == 0 {
		return fmt.Errorf("%w: no queries or expressions are found", ngmodels.ErrAlertRuleFailedValidation)
	}

	if alertRule.Title == "" {
		return fmt.Errorf("%w: title is empty", ngmodels.ErrAlertRuleFailedValidation)
	}

	if alertRule.IntervalSeconds%int64(st.BaseInterval.Seconds()) != 0 || alertRule.IntervalSeconds <= 0 {
		return fmt.Errorf("%w: interval (%v) should be non-zero and divided exactly by scheduler interval: %v", ngmodels.ErrAlertRuleFailedValidation, time.Duration(alertRule.IntervalSeconds)*time.Second, st.BaseInterval)
	}

	// enfore max name length in SQLite
	if len(alertRule.Title) > AlertRuleMaxTitleLength {
		return fmt.Errorf("%w: name length should not be greater than %d", ngmodels.ErrAlertRuleFailedValidation, AlertRuleMaxTitleLength)
	}

	// enfore max rule group name length in SQLite
	if len(alertRule.RuleGroup) > AlertRuleMaxRuleGroupNameLength {
		return fmt.Errorf("%w: rule group name length should not be greater than %d", ngmodels.ErrAlertRuleFailedValidation, AlertRuleMaxRuleGroupNameLength)
	}

	if alertRule.OrgID == 0 {
		return fmt.Errorf("%w: no organisation is found", ngmodels.ErrAlertRuleFailedValidation)
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

			new := ngmodels.AlertRule{
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
			}

			if r.ApiRuleNode != nil {
				new.For = time.Duration(r.ApiRuleNode.For)
				new.Annotations = r.ApiRuleNode.Annotations
				new.Labels = r.ApiRuleNode.Labels
			}

			upsertRule := UpsertRule{
				New: new,
			}

			if existingGroupRule, ok := existingGroupRulesUIDs[r.GrafanaManagedAlert.UID]; ok {
				upsertRule.Existing = &existingGroupRule
				// remove the rule from existingGroupRulesUIDs
				delete(existingGroupRulesUIDs, r.GrafanaManagedAlert.UID)
			}
			upsertRules = append(upsertRules, upsertRule)
		}

		if err := st.UpsertAlertRules(upsertRules); err != nil {
			if st.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
				return ngmodels.ErrAlertRuleUniqueConstraintViolation
			}
			return err
		}

		// delete instances for rules that will not be removed
		for _, rule := range existingGroupRules {
			if _, ok := existingGroupRulesUIDs[rule.UID]; !ok {
				if err := st.DeleteAlertInstancesByRuleUID(cmd.OrgID, rule.UID); err != nil {
					return err
				}
			}
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

func (st DBstore) GetOrgRuleGroups(query *ngmodels.ListOrgRuleGroupsQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		var ruleGroups [][]string
		q := "SELECT DISTINCT rule_group, namespace_uid, (select title from dashboard where org_id = alert_rule.org_id and uid = alert_rule.namespace_uid) FROM alert_rule WHERE org_id = ?"
		if err := sess.SQL(q, query.OrgID).Find(&ruleGroups); err != nil {
			return err
		}

		query.Result = ruleGroups
		return nil
	})
}
