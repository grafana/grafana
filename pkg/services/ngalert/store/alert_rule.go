package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
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

type UpdateRule struct {
	Existing *ngmodels.AlertRule
	New      ngmodels.AlertRule
}

// RuleStore is the interface for persisting alert rules and instances
type RuleStore interface {
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, ruleUID ...string) error
	DeleteAlertInstancesByRuleUID(ctx context.Context, orgID int64, ruleUID string) error
	GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) error
	GetAlertRulesForScheduling(ctx context.Context, query *ngmodels.ListAlertRulesQuery) error
	GetOrgAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) error
	GetAlertRules(ctx context.Context, query *ngmodels.GetAlertRulesQuery) error
	GetUserVisibleNamespaces(context.Context, int64, *models.SignedInUser) (map[string]*models.Folder, error)
	GetNamespaceByTitle(context.Context, string, int64, *models.SignedInUser, bool) (*models.Folder, error)
	InsertAlertRules(ctx context.Context, rule []ngmodels.AlertRule) error
	UpdateAlertRules(ctx context.Context, rule []UpdateRule) error
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

// DeleteAlertRulesByUID is a handler for deleting an alert rule.
func (st DBstore) DeleteAlertRulesByUID(ctx context.Context, orgID int64, ruleUID ...string) error {
	logger := st.Logger.New("org_id", orgID, "rule_uids", ruleUID)
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows, err := sess.Table("alert_rule").Where("org_id = ?", orgID).In("uid", ruleUID).Delete(ngmodels.AlertRule{})
		if err != nil {
			return err
		}
		logger.Debug("deleted alert rules", "count", rows)

		rows, err = sess.Table("alert_rule_version").Where("rule_org_id = ?", orgID).In("rule_uid", ruleUID).Delete(ngmodels.AlertRule{})
		if err != nil {
			return err
		}
		logger.Debug("deleted alert rule versions", "count", rows)

		rows, err = sess.Table("alert_instance").Where("rule_org_id = ?", orgID).In("rule_uid", ruleUID).Delete(ngmodels.AlertRule{})
		if err != nil {
			return err
		}
		logger.Debug("deleted alert instances", "count", rows)
		return nil
	})
}

// DeleteAlertInstanceByRuleUID is a handler for deleting alert instances by alert rule UID when a rule has been updated
func (st DBstore) DeleteAlertInstancesByRuleUID(ctx context.Context, orgID int64, ruleUID string) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM alert_instance WHERE rule_org_id = ? AND rule_uid = ?", orgID, ruleUID)
		if err != nil {
			return err
		}
		return nil
	})
}

// GetAlertRuleByUID is a handler for retrieving an alert rule from that database by its UID and organisation ID.
// It returns ngmodels.ErrAlertRuleNotFound if no alert rule is found for the provided ID.
func (st DBstore) GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		alertRule, err := getAlertRuleByUID(sess, query.UID, query.OrgID)
		if err != nil {
			return err
		}
		query.Result = alertRule
		return nil
	})
}

// InsertAlertRules is a handler for creating/updating alert rules.
func (st DBstore) InsertAlertRules(ctx context.Context, rules []ngmodels.AlertRule) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		newRules := make([]ngmodels.AlertRule, 0, len(rules))
		ruleVersions := make([]ngmodels.AlertRuleVersion, 0, len(rules))
		for i := range rules {
			r := rules[i]
			uid, err := GenerateNewAlertRuleUID(sess, r.OrgID, r.Title)
			if err != nil {
				return fmt.Errorf("failed to generate UID for alert rule %q: %w", r.Title, err)
			}
			r.UID = uid
			r.Version = 1
			if err := st.validateAlertRule(r); err != nil {
				return err
			}
			if err := (&r).PreSave(TimeNow); err != nil {
				return err
			}
			newRules = append(newRules, r)
			ruleVersions = append(ruleVersions, ngmodels.AlertRuleVersion{
				RuleOrgID:        r.OrgID,
				RuleUID:          r.UID,
				RuleNamespaceUID: r.NamespaceUID,
				RuleGroup:        r.RuleGroup,
				ParentVersion:    0,
				Version:          r.Version,
				Created:          r.Updated,
				Condition:        r.Condition,
				Title:            r.Title,
				Data:             r.Data,
				IntervalSeconds:  r.IntervalSeconds,
				NoDataState:      r.NoDataState,
				ExecErrState:     r.ExecErrState,
				For:              r.For,
				Annotations:      r.Annotations,
				Labels:           r.Labels,
			})
		}
		if len(newRules) > 0 {
			if _, err := sess.Insert(&newRules); err != nil {
				if st.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
					return ngmodels.ErrAlertRuleUniqueConstraintViolation
				}
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

// UpdateAlertRules is a handler for creating/updating alert rules.
func (st DBstore) UpdateAlertRules(ctx context.Context, rules []UpdateRule) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		newRules := make([]ngmodels.AlertRule, 0, len(rules))
		ruleVersions := make([]ngmodels.AlertRuleVersion, 0, len(rules))
		for _, r := range rules {
			var parentVersion int64
			r.New.ID = r.Existing.ID
			r.New.Version = r.Existing.Version + 1
			if err := st.validateAlertRule(r.New); err != nil {
				return err
			}
			if err := (&r.New).PreSave(TimeNow); err != nil {
				return err
			}
			// no way to update multiple rules at once
			if _, err := sess.ID(r.Existing.ID).AllCols().Update(r.New); err != nil {
				if st.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
					return ngmodels.ErrAlertRuleUniqueConstraintViolation
				}
				return fmt.Errorf("failed to update rule [%s] %s: %w", r.New.UID, r.New.Title, err)
			}
			parentVersion = r.Existing.Version
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
				if st.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
					return ngmodels.ErrAlertRuleUniqueConstraintViolation
				}
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
func (st DBstore) GetOrgAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		alertRules := make([]*ngmodels.AlertRule, 0)
		q := "SELECT * FROM alert_rule WHERE org_id = ?"
		params := []interface{}{query.OrgID}

		if len(query.NamespaceUIDs) > 0 {
			placeholders := make([]string, 0, len(query.NamespaceUIDs))
			for _, folderUID := range query.NamespaceUIDs {
				params = append(params, folderUID)
				placeholders = append(placeholders, "?")
			}
			q = fmt.Sprintf("%s AND namespace_uid IN (%s)", q, strings.Join(placeholders, ","))
		}

		if query.DashboardUID != "" {
			params = append(params, query.DashboardUID)
			q = fmt.Sprintf("%s AND dashboard_uid = ?", q)
			if query.PanelID != 0 {
				params = append(params, query.PanelID)
				q = fmt.Sprintf("%s AND panel_id = ?", q)
			}
		}

		q = fmt.Sprintf("%s ORDER BY id ASC", q)

		if err := sess.SQL(q, params...).Find(&alertRules); err != nil {
			return err
		}

		query.Result = alertRules
		return nil
	})
}

// GetAlertRules is a handler for retrieving rule group alert rules of specific organisation.
func (st DBstore) GetAlertRules(ctx context.Context, query *ngmodels.GetAlertRulesQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		q := sess.Table("alert_rule").Where("org_id = ? AND namespace_uid = ?", query.OrgID, query.NamespaceUID)
		if query.RuleGroup != nil {
			q = q.Where("rule_group = ?", *query.RuleGroup)
		}
		if query.DashboardUID != "" {
			q = q.Where("dashboard_uid = ?", query.DashboardUID)
			if query.PanelID != 0 {
				q = q.Where("panel_id = ?", query.PanelID)
			}
		}

		alertRules := make([]*ngmodels.AlertRule, 0)
		if err := q.Find(&alertRules); err != nil {
			return err
		}

		query.Result = alertRules
		return nil
	})
}

// GetNamespaces returns the folders that are visible to the user and have at least one alert in it
func (st DBstore) GetUserVisibleNamespaces(ctx context.Context, orgID int64, user *models.SignedInUser) (map[string]*models.Folder, error) {
	namespaceMap := make(map[string]*models.Folder)

	searchQuery := models.FindPersistedDashboardsQuery{
		OrgId:        orgID,
		SignedInUser: user,
		Type:         searchstore.TypeAlertFolder,
		Limit:        -1,
		Permission:   models.PERMISSION_VIEW,
		Sort:         models.SortOption{},
		Filters: []interface{}{
			searchstore.FolderWithAlertsFilter{},
		},
	}

	var page int64 = 1
	for {
		query := searchQuery
		query.Page = page
		proj, err := st.SQLStore.FindDashboards(ctx, &query)
		if err != nil {
			return nil, err
		}

		if len(proj) == 0 {
			break
		}

		for _, hit := range proj {
			if !hit.IsFolder {
				continue
			}
			namespaceMap[hit.UID] = &models.Folder{
				Id:    hit.ID,
				Uid:   hit.UID,
				Title: hit.Title,
			}
		}
		page += 1
	}
	return namespaceMap, nil
}

// GetNamespaceByTitle is a handler for retrieving a namespace by its title. Alerting rules follow a Grafana folder-like structure which we call namespaces.
func (st DBstore) GetNamespaceByTitle(ctx context.Context, namespace string, orgID int64, user *models.SignedInUser, withCanSave bool) (*models.Folder, error) {
	folder, err := st.FolderService.GetFolderByTitle(ctx, user, orgID, namespace)
	if err != nil {
		return nil, err
	}

	// if access control is disabled, check that the user is allowed to save in the folder.
	if withCanSave && st.AccessControl.IsDisabled() {
		g := guardian.New(ctx, folder.Id, orgID, user)
		if canSave, err := g.CanSave(); err != nil || !canSave {
			if err != nil {
				st.Logger.Error("checking can save permission has failed", "userId", user.UserId, "username", user.Login, "namespace", namespace, "orgId", orgID, "error", err)
			}
			return nil, ngmodels.ErrCannotEditNamespace
		}
	}

	return folder, nil
}

// GetAlertRulesForScheduling returns alert rule info (identifier, interval, version state)
// that is useful for it's scheduling.
func (st DBstore) GetAlertRulesForScheduling(ctx context.Context, query *ngmodels.ListAlertRulesQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		alerts := make([]*ngmodels.AlertRule, 0)
		q := "SELECT uid, org_id, interval_seconds, version FROM alert_rule"
		if len(query.ExcludeOrgs) > 0 {
			q = fmt.Sprintf("%s WHERE org_id NOT IN (%s)", q, strings.Join(strings.Split(strings.Trim(fmt.Sprint(query.ExcludeOrgs), "[]"), " "), ","))
		}
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

	if alertRule.DashboardUID == nil && alertRule.PanelID != nil {
		return fmt.Errorf("%w: cannot have Panel ID without a Dashboard UID", ngmodels.ErrAlertRuleFailedValidation)
	}

	return nil
}
