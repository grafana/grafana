package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

// AlertRuleMaxTitleLength is the maximum length of the alert rule title
const AlertRuleMaxTitleLength = 190

// AlertRuleMaxRuleGroupNameLength is the maximum length of the alert rule group name
const AlertRuleMaxRuleGroupNameLength = 190

var (
	ErrAlertRuleGroupNotFound = errors.New("rulegroup not found")
	ErrOptimisticLock         = errors.New("version conflict while updating a record in the database with optimistic locking")
)

func getAlertRuleByUID(sess *db.Session, alertRuleUID string, orgID int64) (*ngmodels.AlertRule, error) {
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
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
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

// IncreaseVersionForAllRulesInNamespace Increases version for all rules that have specified namespace. Returns all rules that belong to the namespace
func (st DBstore) IncreaseVersionForAllRulesInNamespace(ctx context.Context, orgID int64, namespaceUID string) ([]ngmodels.AlertRuleKeyWithVersionAndPauseStatus, error) {
	var keys []ngmodels.AlertRuleKeyWithVersionAndPauseStatus
	err := st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		now := TimeNow()
		_, err := sess.Exec("UPDATE alert_rule SET version = version + 1, updated = ? WHERE namespace_uid = ? AND org_id = ?", now, namespaceUID, orgID)
		if err != nil {
			return err
		}
		return sess.Table(ngmodels.AlertRule{}).Where("namespace_uid = ? AND org_id = ?", namespaceUID, orgID).Find(&keys)
	})
	return keys, err
}

// GetAlertRuleByUID is a handler for retrieving an alert rule from that database by its UID and organisation ID.
// It returns ngmodels.ErrAlertRuleNotFound if no alert rule is found for the provided ID.
func (st DBstore) GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (result *ngmodels.AlertRule, err error) {
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		alertRule, err := getAlertRuleByUID(sess, query.UID, query.OrgID)
		if err != nil {
			return err
		}
		result = alertRule
		return nil
	})
	return result, err
}

// GetAlertRulesGroupByRuleUID is a handler for retrieving a group of alert rules from that database by UID and organisation ID of one of rules that belong to that group.
func (st DBstore) GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) (result []*ngmodels.AlertRule, err error) {
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		var rules []*ngmodels.AlertRule
		err := sess.Table("alert_rule").Alias("a").Join(
			"INNER",
			"alert_rule AS b", "a.org_id = b.org_id AND a.namespace_uid = b.namespace_uid AND a.rule_group = b.rule_group AND b.uid = ?", query.UID,
		).Where("a.org_id = ?", query.OrgID).Select("a.*").Find(&rules)
		if err != nil {
			return err
		}
		result = rules
		return nil
	})
	return result, err
}

// InsertAlertRules is a handler for creating/updating alert rules.
func (st DBstore) InsertAlertRules(ctx context.Context, rules []ngmodels.AlertRule) (map[string]int64, error) {
	ids := make(map[string]int64, len(rules))
	return ids, st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		newRules := make([]ngmodels.AlertRule, 0, len(rules))
		ruleVersions := make([]ngmodels.AlertRuleVersion, 0, len(rules))
		for i := range rules {
			r := rules[i]
			if r.UID == "" {
				uid, err := GenerateNewAlertRuleUID(sess, r.OrgID, r.Title)
				if err != nil {
					return fmt.Errorf("failed to generate UID for alert rule %q: %w", r.Title, err)
				}
				r.UID = uid
			}
			r.Version = 1
			if err := st.validateAlertRule(r); err != nil {
				return err
			}
			if err := (&r).PreSave(TimeNow); err != nil {
				return err
			}
			newRules = append(newRules, r)
			ruleVersions = append(ruleVersions, ngmodels.AlertRuleVersion{
				RuleUID:          r.UID,
				RuleOrgID:        r.OrgID,
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
			// we have to insert the rules one by one as otherwise we are
			// not able to fetch the inserted id as it's not supported by xorm
			for i := range newRules {
				if _, err := sess.Insert(&newRules[i]); err != nil {
					if st.SQLStore.GetDialect().IsUniqueConstraintViolation(err) {
						return ngmodels.ErrAlertRuleUniqueConstraintViolation
					}
					return fmt.Errorf("failed to create new rules: %w", err)
				}
				ids[newRules[i].UID] = newRules[i].ID
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

// UpdateAlertRules is a handler for updating alert rules.
func (st DBstore) UpdateAlertRules(ctx context.Context, rules []ngmodels.UpdateRule) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		ruleVersions := make([]ngmodels.AlertRuleVersion, 0, len(rules))
		for _, r := range rules {
			var parentVersion int64
			r.New.ID = r.Existing.ID
			r.New.Version = r.Existing.Version // xorm will take care of increasing it (see https://xorm.io/docs/chapter-06/1.lock/)
			if err := st.validateAlertRule(r.New); err != nil {
				return err
			}
			if err := (&r.New).PreSave(TimeNow); err != nil {
				return err
			}
			// no way to update multiple rules at once
			if updated, err := sess.ID(r.Existing.ID).AllCols().Update(r.New); err != nil || updated == 0 {
				if err != nil {
					if st.SQLStore.GetDialect().IsUniqueConstraintViolation(err) {
						return ngmodels.ErrAlertRuleUniqueConstraintViolation
					}
					return fmt.Errorf("failed to update rule [%s] %s: %w", r.New.UID, r.New.Title, err)
				}
				return fmt.Errorf("%w: alert rule UID %s version %d", ErrOptimisticLock, r.New.UID, r.New.Version)
			}
			parentVersion = r.Existing.Version
			ruleVersions = append(ruleVersions, ngmodels.AlertRuleVersion{
				RuleOrgID:        r.New.OrgID,
				RuleUID:          r.New.UID,
				RuleNamespaceUID: r.New.NamespaceUID,
				RuleGroup:        r.New.RuleGroup,
				RuleGroupIndex:   r.New.RuleGroupIndex,
				ParentVersion:    parentVersion,
				Version:          r.New.Version + 1,
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
		if len(ruleVersions) > 0 {
			if _, err := sess.Insert(&ruleVersions); err != nil {
				return fmt.Errorf("failed to create new rule versions: %w", err)
			}
		}
		return nil
	})
}

// CountAlertRulesInFolder is a handler for retrieving the number of alert rules of
// specific organisation associated with a given namespace (parent folder).
func (st DBstore) CountAlertRulesInFolder(ctx context.Context, query *ngmodels.CountAlertRulesQuery) (int64, error) {
	var count int64
	var err error
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		q := sess.Table("alert_rule").Where("org_id = ?", query.OrgID).Where("namespace_uid = ?", query.NamespaceUID)
		count, err = q.Count()
		return err
	})
	return count, err
}

// ListAlertRules is a handler for retrieving alert rules of specific organisation.
func (st DBstore) ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (result ngmodels.RulesGroup, err error) {
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		q := sess.Table("alert_rule")

		if query.OrgID >= 0 {
			q = q.Where("org_id = ?", query.OrgID)
		}

		if query.DashboardUID != "" {
			q = q.Where("dashboard_uid = ?", query.DashboardUID)
			if query.PanelID != 0 {
				q = q.Where("panel_id = ?", query.PanelID)
			}
		}

		if len(query.NamespaceUIDs) > 0 {
			args := make([]interface{}, 0, len(query.NamespaceUIDs))
			in := make([]string, 0, len(query.NamespaceUIDs))
			for _, namespaceUID := range query.NamespaceUIDs {
				args = append(args, namespaceUID)
				in = append(in, "?")
			}
			q = q.Where(fmt.Sprintf("namespace_uid IN (%s)", strings.Join(in, ",")), args...)
		}

		if query.RuleGroup != "" {
			q = q.Where("rule_group = ?", query.RuleGroup)
		}

		q = q.Asc("namespace_uid", "rule_group", "rule_group_idx", "id")

		alertRules := make([]*ngmodels.AlertRule, 0)
		rule := new(ngmodels.AlertRule)
		rows, err := q.Rows(rule)
		if err != nil {
			return err
		}
		defer func() {
			_ = rows.Close()
		}()

		// Deserialize each rule separately in case any of them contain invalid JSON.
		for rows.Next() {
			rule := new(ngmodels.AlertRule)
			err = rows.Scan(rule)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, ignoring it", "func", "ListAlertRules", "error", err)
				continue
			}
			alertRules = append(alertRules, rule)
		}

		result = alertRules
		return nil
	})
	return result, err
}

// Count returns either the number of the alert rules under a specific org (if orgID is not zero)
// or the number of all the alert rules
func (st DBstore) Count(ctx context.Context, orgID int64) (int64, error) {
	type result struct {
		Count int64
	}

	r := result{}
	err := st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := "SELECT COUNT(*) as count from alert_rule"
		args := make([]interface{}, 0)
		if orgID != 0 {
			rawSQL += " WHERE org_id=?"
			args = append(args, orgID)
		}
		if _, err := sess.SQL(rawSQL, args...).Get(&r); err != nil {
			return err
		}
		return nil
	})
	return r.Count, err
}

func (st DBstore) GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error) {
	var interval int64 = 0
	return interval, st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		ruleGroups := make([]ngmodels.AlertRule, 0)
		err := sess.Find(
			&ruleGroups,
			ngmodels.AlertRule{OrgID: orgID, RuleGroup: ruleGroup, NamespaceUID: namespaceUID},
		)
		if len(ruleGroups) == 0 {
			return ErrAlertRuleGroupNotFound
		}
		interval = ruleGroups[0].IntervalSeconds
		return err
	})
}

// GetUserVisibleNamespaces returns the folders that are visible to the user and have at least one alert in it
func (st DBstore) GetUserVisibleNamespaces(ctx context.Context, orgID int64, user *user.SignedInUser) (map[string]*folder.Folder, error) {
	namespaceMap := make(map[string]*folder.Folder)

	searchQuery := dashboards.FindPersistedDashboardsQuery{
		OrgId:        orgID,
		SignedInUser: user,
		Type:         searchstore.TypeAlertFolder,
		Limit:        -1,
		Permission:   dashboards.PERMISSION_VIEW,
		Sort:         model.SortOption{},
		Filters: []interface{}{
			searchstore.FolderWithAlertsFilter{},
		},
	}

	var page int64 = 1
	for {
		query := searchQuery
		query.Page = page
		proj, err := st.DashboardService.FindDashboards(ctx, &query)
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
			namespaceMap[hit.UID] = &folder.Folder{
				ID:    hit.ID,
				UID:   hit.UID,
				Title: hit.Title,
			}
		}
		page += 1
	}
	return namespaceMap, nil
}

// GetNamespaceByTitle is a handler for retrieving a namespace by its title. Alerting rules follow a Grafana folder-like structure which we call namespaces.
func (st DBstore) GetNamespaceByTitle(ctx context.Context, namespace string, orgID int64, user *user.SignedInUser, withCanSave bool) (*folder.Folder, error) {
	folder, err := st.FolderService.Get(ctx, &folder.GetFolderQuery{OrgID: orgID, Title: &namespace, SignedInUser: user})
	if err != nil {
		return nil, err
	}

	// if access control is disabled, check that the user is allowed to save in the folder.
	if withCanSave && st.AccessControl.IsDisabled() {
		g, err := guardian.NewByUID(ctx, folder.UID, orgID, user)
		if err != nil {
			return folder, err
		}

		if canSave, err := g.CanSave(); err != nil || !canSave {
			if err != nil {
				st.Logger.Error("checking can save permission has failed", "userId", user.UserID, "username", user.Login, "namespace", namespace, "orgId", orgID, "error", err)
			}
			return nil, ngmodels.ErrCannotEditNamespace
		}
	}

	return folder, nil
}

// GetNamespaceByUID is a handler for retrieving a namespace by its UID. Alerting rules follow a Grafana folder-like structure which we call namespaces.
func (st DBstore) GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user *user.SignedInUser) (*folder.Folder, error) {
	folder, err := st.FolderService.Get(ctx, &folder.GetFolderQuery{OrgID: orgID, Title: &uid, SignedInUser: user})
	if err != nil {
		return nil, err
	}

	return folder, nil
}

func (st DBstore) GetAlertRulesKeysForScheduling(ctx context.Context) ([]ngmodels.AlertRuleKeyWithVersion, error) {
	var result []ngmodels.AlertRuleKeyWithVersion
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		alertRulesSql := sess.Table("alert_rule").Select("org_id, uid, version")
		if len(st.Cfg.DisabledOrgs) > 0 {
			var ids []int64
			for orgID := range st.Cfg.DisabledOrgs {
				ids = append(ids, orgID)
			}

			alertRulesSql = alertRulesSql.NotIn("org_id", ids)
		}
		if err := alertRulesSql.Find(&result); err != nil {
			return err
		}
		return nil
	})
	return result, err
}

// GetAlertRulesForScheduling returns a short version of all alert rules except those that belong to an excluded list of organizations
func (st DBstore) GetAlertRulesForScheduling(ctx context.Context, query *ngmodels.GetAlertRulesForSchedulingQuery) error {
	var folders []struct {
		Uid   string
		Title string
	}
	var rules []*ngmodels.AlertRule
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		var ids []int64
		if len(st.Cfg.DisabledOrgs) > 0 {
			for orgID := range st.Cfg.DisabledOrgs {
				ids = append(ids, orgID)
			}
		}

		//<<<<<<< HEAD
		alertRulesSql := sess.Table("alert_rule").Select("*")
		if len(ids) > 0 {
			alertRulesSql.NotIn("org_id", ids)
		}

		if len(query.RuleGroups) > 0 {
			alertRulesSql = alertRulesSql.In("rule_group", query.RuleGroups)
		}

		rule := new(ngmodels.AlertRule)
		rows, err := alertRulesSql.Rows(rule)
		if err != nil {
			return fmt.Errorf("failed to fetch alert rules: %w", err)
		}

		// Deserialize each rule separately in case any of them contain invalid JSON.
		for rows.Next() {
			rule := new(ngmodels.AlertRule)
			err = rows.Scan(rule)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, ignoring it", "func", "GetAlertRulesForScheduling", "error", err)
				continue
			}
			rules = append(rules, rule)
		}

		query.ResultRules = rules

		if query.PopulateFolders {
			foldersSql := sess.Table("dashboard").Alias("d").Select("d.uid, d.title").
				Where("is_folder = ?", true).
				And(`EXISTS (SELECT 1 FROM alert_rule a WHERE d.uid = a.namespace_uid)`)
			if len(ids) > 0 {
				foldersSql = foldersSql.NotIn("org_id", ids)
			}

			if err := foldersSql.Find(&folders); err != nil {
				return fmt.Errorf("failed to fetch a list of folders that contain alert rules: %w", err)
			}
			query.ResultFoldersTitles = make(map[string]string, len(folders))
			for _, folder := range folders {
				query.ResultFoldersTitles[folder.Uid] = folder.Title
			}
		}
		return nil
	})
}

// GenerateNewAlertRuleUID generates a unique UID for a rule.
// This is set as a variable so that the tests can override it.
// The ruleTitle is only used by the mocked functions.
var GenerateNewAlertRuleUID = func(sess *db.Session, orgID int64, ruleTitle string) (string, error) {
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

	if err := ngmodels.ValidateRuleGroupInterval(alertRule.IntervalSeconds, int64(st.Cfg.BaseInterval.Seconds())); err != nil {
		return err
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

	if _, err := ngmodels.ErrStateFromString(string(alertRule.ExecErrState)); err != nil {
		return err
	}

	if _, err := ngmodels.NoDataStateFromString(string(alertRule.NoDataState)); err != nil {
		return err
	}

	if alertRule.For < 0 {
		return fmt.Errorf("%w: field `for` cannot be negative", ngmodels.ErrAlertRuleFailedValidation)
	}
	return nil
}
