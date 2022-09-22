package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
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

var (
	ErrAlertRuleGroupNotFound = errors.New("rulegroup not found")
	ErrOptimisticLock         = errors.New("version conflict while updating a record in the database with optimistic locking")
)

// RuleStore is the interface for persisting alert rules and instances
type RuleStore interface {
	DeleteAlertRulesByUID(ctx context.Context, orgID int64, ruleUID ...string) error
	DeleteAlertInstancesByRuleUID(ctx context.Context, orgID int64, ruleUID string) error
	GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) error
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) error
	ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) error
	// GetRuleGroups returns the unique rule groups across all organizations.
	GetRuleGroups(ctx context.Context, query *ngmodels.ListRuleGroupsQuery) error
	GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error)
	GetUserVisibleNamespaces(context.Context, int64, *user.SignedInUser) (map[string]*models.Folder, error)
	GetNamespaceByTitle(context.Context, string, int64, *user.SignedInUser, bool) (*models.Folder, error)
	GetNamespaceByUID(context.Context, string, int64, *user.SignedInUser) (*models.Folder, error)
	// InsertAlertRules will insert all alert rules passed into the function
	// and return the map of uuid to id.
	InsertAlertRules(ctx context.Context, rule []ngmodels.AlertRule) (map[string]int64, error)
	UpdateAlertRules(ctx context.Context, rule []UpdateRule) error

	// IncreaseVersionForAllRulesInNamespace Increases version for all rules that have specified namespace. Returns all rules that belong to the namespace
	IncreaseVersionForAllRulesInNamespace(ctx context.Context, orgID int64, namespaceUID string) ([]ngmodels.AlertRuleKeyWithVersion, error)
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

// IncreaseVersionForAllRulesInNamespace Increases version for all rules that have specified namespace. Returns all rules that belong to the namespace
func (st DBstore) IncreaseVersionForAllRulesInNamespace(ctx context.Context, orgID int64, namespaceUID string) ([]ngmodels.AlertRuleKeyWithVersion, error) {
	var keys []ngmodels.AlertRuleKeyWithVersion
	err := st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		now := TimeNow()
		_, err := sess.Exec("UPDATE alert_rule SET version = version + 1, updated = ? WHERE namespace_uid = ? AND org_id = ?", now, namespaceUID, orgID)
		if err != nil {
			return err
		}
		return sess.Table(ngmodels.AlertRule{}).Where("namespace_uid = ? AND org_id = ?", namespaceUID, orgID).Find(&keys)
	})
	return keys, err
}

// DeleteAlertInstancesByRuleUID is a handler for deleting alert instances by alert rule UID when a rule has been updated
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

// GetAlertRulesGroupByRuleUID is a handler for retrieving a group of alert rules from that database by UID and organisation ID of one of rules that belong to that group.
func (st DBstore) GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var result []*ngmodels.AlertRule
		err := sess.Table("alert_rule").Alias("A").Join(
			"INNER",
			"alert_rule AS B", "A.org_id = B.org_id AND A.namespace_uid = B.namespace_uid AND A.rule_group = B.rule_group AND B.uid = ?", query.UID,
		).Where("A.org_id = ?", query.OrgID).Select("A.*").Find(&result)
		if err != nil {
			return err
		}
		query.Result = result
		return nil
	})
}

// InsertAlertRules is a handler for creating/updating alert rules.
func (st DBstore) InsertAlertRules(ctx context.Context, rules []ngmodels.AlertRule) (map[string]int64, error) {
	ids := make(map[string]int64, len(rules))
	return ids, st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
					if st.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
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
func (st DBstore) UpdateAlertRules(ctx context.Context, rules []UpdateRule) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
					if st.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
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

// ListAlertRules is a handler for retrieving alert rules of specific organisation.
func (st DBstore) ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
		if err := q.Find(&alertRules); err != nil {
			return err
		}

		query.Result = alertRules
		return nil
	})
}

func (st DBstore) GetRuleGroups(ctx context.Context, query *ngmodels.ListRuleGroupsQuery) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		ruleGroups := make([]string, 0)
		if err := sess.Table("alert_rule").Distinct("rule_group").Find(&ruleGroups); err != nil {
			return err
		}
		query.Result = ruleGroups
		return nil
	})
}

func (st DBstore) GetRuleGroupInterval(ctx context.Context, orgID int64, namespaceUID string, ruleGroup string) (int64, error) {
	var interval int64 = 0
	return interval, st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
func (st DBstore) GetUserVisibleNamespaces(ctx context.Context, orgID int64, user *user.SignedInUser) (map[string]*models.Folder, error) {
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
func (st DBstore) GetNamespaceByTitle(ctx context.Context, namespace string, orgID int64, user *user.SignedInUser, withCanSave bool) (*models.Folder, error) {
	folder, err := st.FolderService.GetFolderByTitle(ctx, user, orgID, namespace)
	if err != nil {
		return nil, err
	}

	// if access control is disabled, check that the user is allowed to save in the folder.
	if withCanSave && st.AccessControl.IsDisabled() {
		g := guardian.New(ctx, folder.Id, orgID, user)
		if canSave, err := g.CanSave(); err != nil || !canSave {
			if err != nil {
				st.Logger.Error("checking can save permission has failed", "userId", user.UserID, "username", user.Login, "namespace", namespace, "orgId", orgID, "err", err)
			}
			return nil, ngmodels.ErrCannotEditNamespace
		}
	}

	return folder, nil
}

// GetNamespaceByUID is a handler for retrieving a namespace by its UID. Alerting rules follow a Grafana folder-like structure which we call namespaces.
func (st DBstore) GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user *user.SignedInUser) (*models.Folder, error) {
	folder, err := st.FolderService.GetFolderByUID(ctx, user, orgID, uid)
	if err != nil {
		return nil, err
	}

	return folder, nil
}

func (st DBstore) getFilterByOrgsString() (string, []interface{}) {
	if len(st.Cfg.DisabledOrgs) == 0 {
		return "", nil
	}
	builder := strings.Builder{}
	builder.WriteString("org_id NOT IN(")
	idx := len(st.Cfg.DisabledOrgs)
	args := make([]interface{}, 0, len(st.Cfg.DisabledOrgs))
	for orgId := range st.Cfg.DisabledOrgs {
		args = append(args, orgId)
		builder.WriteString("?")
		idx--
		if idx == 0 {
			builder.WriteString(")")
			break
		}
		builder.WriteString(",")
	}
	return builder.String(), args
}

func (st DBstore) GetAlertRulesKeysForScheduling(ctx context.Context) ([]ngmodels.AlertRuleKeyWithVersion, error) {
	var result []ngmodels.AlertRuleKeyWithVersion
	err := st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		alertRulesSql := "SELECT org_id, uid, version FROM alert_rule"
		filter, args := st.getFilterByOrgsString()
		if filter != "" {
			alertRulesSql += " WHERE " + filter
		}
		if err := sess.SQL(alertRulesSql, args...).Find(&result); err != nil {
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
	return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		foldersSql := "SELECT D.uid, D.title FROM dashboard AS D WHERE is_folder IS TRUE AND EXISTS (SELECT 1 FROM alert_rule AS A WHERE D.uid = A.namespace_uid)"
		alertRulesSql := "SELECT * FROM alert_rule"
		filter, args := st.getFilterByOrgsString()
		if filter != "" {
			foldersSql += " AND " + filter
			alertRulesSql += " WHERE " + filter
		}

		if err := sess.SQL(alertRulesSql, args...).Find(&rules); err != nil {
			return fmt.Errorf("failed to fetch alert rules: %w", err)
		}
		query.ResultRules = rules
		if query.PopulateFolders {
			if err := sess.SQL(foldersSql, args...).Find(&folders); err != nil {
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
