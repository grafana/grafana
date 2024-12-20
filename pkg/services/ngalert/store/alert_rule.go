package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/exp/maps"
	"golang.org/x/exp/slices"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/util"
)

// AlertRuleMaxTitleLength is the maximum length of the alert rule title
const AlertRuleMaxTitleLength = 190

// AlertRuleMaxRuleGroupNameLength is the maximum length of the alert rule group name
const AlertRuleMaxRuleGroupNameLength = 190

var (
	ErrOptimisticLock = errors.New("version conflict while updating a record in the database with optimistic locking")
)

// DeleteAlertRulesByUID is a handler for deleting an alert rule.
func (st DBstore) DeleteAlertRulesByUID(ctx context.Context, orgID int64, ruleUID ...string) error {
	logger := st.Logger.New("org_id", orgID, "rule_uids", ruleUID)
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.Table(alertRule{}).Where("org_id = ?", orgID).In("uid", ruleUID).Delete(alertRule{})
		if err != nil {
			return err
		}
		logger.Debug("Deleted alert rules", "count", rows)
		if rows > 0 {
			keys := make([]ngmodels.AlertRuleKey, 0, len(ruleUID))
			for _, uid := range ruleUID {
				keys = append(keys, ngmodels.AlertRuleKey{OrgID: orgID, UID: uid})
			}
			_ = st.Bus.Publish(ctx, &RuleChangeEvent{
				RuleKeys: keys,
			})
		}

		rows, err = sess.Table(alertRuleVersion{}).Where("rule_org_id = ?", orgID).In("rule_uid", ruleUID).Delete(alertRule{})
		if err != nil {
			return err
		}
		logger.Debug("Deleted alert rule versions", "count", rows)

		rows, err = sess.Table("alert_instance").Where("rule_org_id = ?", orgID).In("rule_uid", ruleUID).Delete(alertRule{})
		if err != nil {
			return err
		}
		logger.Debug("Deleted alert instances", "count", rows)
		return nil
	})
}

// IncreaseVersionForAllRulesInNamespaces Increases version for all rules that have specified namespace. Returns all rules that belong to the namespaces
func (st DBstore) IncreaseVersionForAllRulesInNamespaces(ctx context.Context, orgID int64, namespaceUIDs []string) ([]ngmodels.AlertRuleKeyWithVersion, error) {
	var keys []ngmodels.AlertRuleKeyWithVersion
	err := st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		now := TimeNow()
		namespaceUIDsArgs, in := getINSubQueryArgs(namespaceUIDs)
		sql := fmt.Sprintf(
			"UPDATE alert_rule SET version = version + 1, updated = ? WHERE org_id = ? AND namespace_uid IN (%s)",
			strings.Join(in, ","),
		)
		args := make([]interface{}, 0, 3+len(namespaceUIDsArgs))
		args = append(args, sql, now, orgID)
		args = append(args, namespaceUIDsArgs...)

		_, err := sess.Exec(args...)
		if err != nil {
			return err
		}

		return sess.Table(alertRule{}).Where("org_id = ?", orgID).In("namespace_uid", namespaceUIDs).Find(&keys)
	})
	return keys, err
}

// GetAlertRuleByUID is a handler for retrieving an alert rule from that database by its UID and organisation ID.
// It returns ngmodels.ErrAlertRuleNotFound if no alert rule is found for the provided ID.
func (st DBstore) GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (result *ngmodels.AlertRule, err error) {
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		alertRule := alertRule{OrgID: query.OrgID, UID: query.UID}
		has, err := sess.Get(&alertRule)
		if err != nil {
			return err
		}
		if !has {
			return ngmodels.ErrAlertRuleNotFound
		}
		r, err := alertRuleToModelsAlertRule(alertRule, st.Logger)
		if err != nil {
			return fmt.Errorf("failed to convert alert rule: %w", err)
		}
		result = &r
		return nil
	})
	return result, err
}

// GetRuleByID retrieves models.AlertRule by ID.
// It returns models.ErrAlertRuleNotFound if no alert rule is found for the provided ID.
func (st DBstore) GetRuleByID(ctx context.Context, query ngmodels.GetAlertRuleByIDQuery) (result *ngmodels.AlertRule, err error) {
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		alertRule := alertRule{OrgID: query.OrgID, ID: query.ID}
		has, err := sess.Get(&alertRule)
		if err != nil {
			return err
		}
		if !has {
			return ngmodels.ErrAlertRuleNotFound
		}
		r, err := alertRuleToModelsAlertRule(alertRule, st.Logger)
		if err != nil {
			return fmt.Errorf("failed to convert alert rule: %w", err)
		}
		result = &r
		return nil
	})
	return result, err
}

// GetAlertRulesGroupByRuleUID is a handler for retrieving a group of alert rules from that database by UID and organisation ID of one of rules that belong to that group.
func (st DBstore) GetAlertRulesGroupByRuleUID(ctx context.Context, query *ngmodels.GetAlertRulesGroupByRuleUIDQuery) (result []*ngmodels.AlertRule, err error) {
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		var rules []alertRule
		err := sess.Table("alert_rule").Alias("a").Join(
			"INNER",
			"alert_rule AS b", "a.org_id = b.org_id AND a.namespace_uid = b.namespace_uid AND a.rule_group = b.rule_group AND b.uid = ?", query.UID,
		).Where("a.org_id = ?", query.OrgID).Select("a.*").Find(&rules)
		if err != nil {
			return err
		}
		// MySQL by default compares strings without case-sensitivity, make sure we keep the case-sensitive comparison.
		var groupName, namespaceUID string
		// find the rule, which group we fetch
		for _, rule := range rules {
			if rule.UID == query.UID {
				groupName = rule.RuleGroup
				namespaceUID = rule.NamespaceUID
				break
			}
		}
		result = make([]*ngmodels.AlertRule, 0, len(rules))
		// MySQL (and potentially other databases) can use case-insensitive comparison.
		// This code makes sure we return groups that only exactly match the filter.
		for _, rule := range rules {
			if rule.RuleGroup != groupName || rule.NamespaceUID != namespaceUID {
				continue
			}
			convert, err := alertRuleToModelsAlertRule(rule, st.Logger)
			if err != nil {
				return fmt.Errorf("failed to convert alert rule %q: %w", rule.UID, err)
			}
			result = append(result, &convert)
		}
		return nil
	})
	return result, err
}

// InsertAlertRules is a handler for creating/updating alert rules.
// Returns the UID and ID of rules that were created in the same order as the input rules.
func (st DBstore) InsertAlertRules(ctx context.Context, rules []ngmodels.AlertRule) ([]ngmodels.AlertRuleKeyWithId, error) {
	ids := make([]ngmodels.AlertRuleKeyWithId, 0, len(rules))
	keys := make([]ngmodels.AlertRuleKey, 0, len(rules))
	return ids, st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		newRules := make([]alertRule, 0, len(rules))
		ruleVersions := make([]alertRuleVersion, 0, len(rules))
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

			converted, err := alertRuleFromModelsAlertRule(r)
			if err != nil {
				return fmt.Errorf("failed to convert alert rule %q to storage model: %w", r.Title, err)
			}
			newRules = append(newRules, converted)
			ruleVersions = append(ruleVersions, alertRuleToAlertRuleVersion(converted))
		}
		if len(newRules) > 0 {
			// we have to insert the rules one by one as otherwise we are
			// not able to fetch the inserted id as it's not supported by xorm
			for i := range newRules {
				if _, err := sess.Insert(&newRules[i]); err != nil {
					if st.SQLStore.GetDialect().IsUniqueConstraintViolation(err) {
						return ruleConstraintViolationToErr(sess, rules[i], err, st.Logger)
					}
					return fmt.Errorf("failed to create new rules: %w", err)
				}
				r := newRules[i]
				key := ngmodels.AlertRuleKey{OrgID: r.OrgID, UID: r.UID}

				ids = append(ids, ngmodels.AlertRuleKeyWithId{AlertRuleKey: key, ID: r.ID})
				keys = append(keys, key)
			}
		}

		if len(ruleVersions) > 0 {
			if _, err := sess.Insert(&ruleVersions); err != nil {
				return fmt.Errorf("failed to create new rule versions: %w", err)
			}
		}

		if len(keys) > 0 {
			_ = st.Bus.Publish(ctx, &RuleChangeEvent{
				RuleKeys: keys,
			})
		}
		return nil
	})
}

// UpdateAlertRules is a handler for updating alert rules.
func (st DBstore) UpdateAlertRules(ctx context.Context, rules []ngmodels.UpdateRule) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		err := st.preventIntermediateUniqueConstraintViolations(sess, rules)
		if err != nil {
			return fmt.Errorf("failed when preventing intermediate unique constraint violation: %w", err)
		}

		ruleVersions := make([]alertRuleVersion, 0, len(rules))
		keys := make([]ngmodels.AlertRuleKey, 0, len(rules))
		for i := range rules {
			// We do indexed access way to avoid "G601: Implicit memory aliasing in for loop."
			// Doing this will be unnecessary with go 1.22 https://stackoverflow.com/a/68247837/767660
			r := rules[i]
			r.New.ID = r.Existing.ID
			r.New.Version = r.Existing.Version // xorm will take care of increasing it (see https://xorm.io/docs/chapter-06/1.lock/)
			if err := st.validateAlertRule(r.New); err != nil {
				return err
			}
			if err := (&r.New).PreSave(TimeNow); err != nil {
				return err
			}
			converted, err := alertRuleFromModelsAlertRule(r.New)
			if err != nil {
				return fmt.Errorf("failed to convert alert rule %s to storage model: %w", r.New.UID, err)
			}
			// no way to update multiple rules at once
			if updated, err := sess.ID(r.Existing.ID).AllCols().Update(converted); err != nil || updated == 0 {
				if err != nil {
					if st.SQLStore.GetDialect().IsUniqueConstraintViolation(err) {
						return ruleConstraintViolationToErr(sess, r.New, err, st.Logger)
					}
					return fmt.Errorf("failed to update rule [%s] %s: %w", r.New.UID, r.New.Title, err)
				}
				return fmt.Errorf("%w: alert rule UID %s version %d", ErrOptimisticLock, r.New.UID, r.New.Version)
			}
			v := alertRuleToAlertRuleVersion(converted)
			v.Version++
			v.ParentVersion = r.Existing.Version
			ruleVersions = append(ruleVersions, v)
			keys = append(keys, ngmodels.AlertRuleKey{OrgID: r.New.OrgID, UID: r.New.UID})
		}
		if len(ruleVersions) > 0 {
			if _, err := sess.Insert(&ruleVersions); err != nil {
				return fmt.Errorf("failed to create new rule versions: %w", err)
			}

			for _, rule := range ruleVersions {
				// delete old versions of alert rule
				_, err = st.deleteOldAlertRuleVersions(ctx, rule.RuleUID, rule.RuleOrgID, st.Cfg.RuleVersionRecordLimit)
				if err != nil {
					st.Logger.Warn("Failed to delete old alert rule versions", "org", rule.RuleOrgID, "rule", rule.RuleUID, "error", err)
				}
			}
		}
		if len(keys) > 0 {
			_ = st.Bus.Publish(ctx, &RuleChangeEvent{
				RuleKeys: keys,
			})
		}
		return nil
	})
}

func (st DBstore) deleteOldAlertRuleVersions(ctx context.Context, ruleUID string, orgID int64, limit int) (int64, error) {
	if limit < 0 {
		return 0, fmt.Errorf("failed to delete old alert rule versions: limit is set to '%d' but needs to be > 0", limit)
	}

	if limit < 1 {
		return 0, nil
	}

	var affectedRows int64
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		highest := &alertRuleVersion{}
		ok, err := sess.Table("alert_rule_version").Desc("id").Where("rule_org_id = ?", orgID).Where("rule_uid = ?", ruleUID).Limit(1, limit).Get(highest)
		if err != nil {
			return err
		}
		if !ok {
			// No alert rule versions past the limit exist. Nothing to clean up.
			affectedRows = 0
			return nil
		}

		res, err := sess.Exec(`
			DELETE FROM
				alert_rule_version
			WHERE
				rule_org_id = ? AND rule_uid = ?
			AND
				id <= ?
		`, orgID, ruleUID, highest.ID)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		affectedRows = rows
		if affectedRows > 0 {
			st.Logger.Info("Deleted old alert_rule_version(s)", "org", orgID, "limit", limit, "delete_count", affectedRows)
		}
		return nil
	})
	return affectedRows, err
}

// preventIntermediateUniqueConstraintViolations prevents unique constraint violations caused by an intermediate update.
// The uniqueness constraint for titles within an org+folder is enforced on every update within a transaction
// instead of on commit (deferred constraint). This means that there could be a set of updates that will throw
// a unique constraint violation in an intermediate step even though the final state is valid.
// For example, a chain of updates RuleA -> RuleB -> RuleC could fail if not executed in the correct order, or
// a swap of titles RuleA <-> RuleB cannot be executed in any order without violating the constraint.
func (st DBstore) preventIntermediateUniqueConstraintViolations(sess *db.Session, updates []ngmodels.UpdateRule) error {
	// The exact solution to this is complex and requires determining directed paths and cycles in the update graph,
	// adding in temporary updates to break cycles, and then executing the updates in reverse topological order.
	// This is not implemented here. Instead, we choose a simpler solution that works in all cases but might perform
	// more updates than necessary. This simpler solution makes a determination of whether an intermediate collision
	// could occur and if so, adds a temporary title on all updated rules to break any cycles and remove the need for
	// specific ordering.

	titleUpdates := make([]ngmodels.UpdateRule, 0)
	for _, update := range updates {
		if update.Existing.Title != update.New.Title {
			titleUpdates = append(titleUpdates, update)
		}
	}

	// If there is no overlap then an intermediate unique constraint violation is not possible. If there is an overlap,
	// then there is the possibility of intermediate unique constraint violation.
	if !newTitlesOverlapExisting(titleUpdates) {
		return nil
	}
	st.Logger.Debug("Detected possible intermediate unique constraint violation, creating temporary title updates", "updates", len(titleUpdates))

	for _, update := range titleUpdates {
		r := update.Existing
		u := uuid.New().String()

		// Some defensive programming in case the temporary title is somehow persisted it will still be recognizable.
		uniqueTempTitle := r.Title + u
		if len(uniqueTempTitle) > AlertRuleMaxTitleLength {
			uniqueTempTitle = r.Title[:AlertRuleMaxTitleLength-len(u)] + uuid.New().String()
		}

		if updated, err := sess.ID(r.ID).Cols("title").Update(&alertRule{Title: uniqueTempTitle, Version: r.Version}); err != nil || updated == 0 {
			if err != nil {
				return fmt.Errorf("failed to set temporary rule title [%s] %s: %w", r.UID, r.Title, err)
			}
			return fmt.Errorf("%w: alert rule UID %s version %d", ErrOptimisticLock, r.UID, r.Version)
		}
		// Otherwise optimistic locking will conflict on the 2nd update.
		r.Version++
		// For consistency.
		r.Title = uniqueTempTitle
	}

	return nil
}

// newTitlesOverlapExisting returns true if any new titles overlap with existing titles.
// It does so in a case-insensitive manner as some supported databases perform case-insensitive comparisons.
func newTitlesOverlapExisting(rules []ngmodels.UpdateRule) bool {
	existingTitles := make(map[string]struct{}, len(rules))
	for _, r := range rules {
		existingTitles[strings.ToLower(r.Existing.Title)] = struct{}{}
	}

	// Check if there is any overlap between lower case existing and new titles.
	for _, r := range rules {
		if _, ok := existingTitles[strings.ToLower(r.New.Title)]; ok {
			return true
		}
	}

	return false
}

// CountInFolder is a handler for retrieving the number of alert rules of
// specific organisation associated with a given namespace (parent folder).
func (st DBstore) CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, _ identity.Requester) (int64, error) {
	if len(folderUIDs) == 0 {
		return 0, nil
	}
	var count int64
	var err error
	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		args := make([]any, 0, len(folderUIDs))
		for _, folderUID := range folderUIDs {
			args = append(args, folderUID)
		}
		q := sess.Table("alert_rule").Where("org_id = ?", orgID).Where(fmt.Sprintf("namespace_uid IN (%s)", strings.Repeat("?,", len(folderUIDs)-1)+"?"), args...)
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
			args, in := getINSubQueryArgs(query.NamespaceUIDs)
			q = q.Where(fmt.Sprintf("namespace_uid IN (%s)", strings.Join(in, ",")), args...)
		}

		if len(query.RuleUIDs) > 0 {
			args, in := getINSubQueryArgs(query.RuleUIDs)
			q = q.Where(fmt.Sprintf("uid IN (%s)", strings.Join(in, ",")), args...)
		}

		var groupsMap map[string]struct{}
		if len(query.RuleGroups) > 0 {
			groupsMap = make(map[string]struct{})
			args, in := getINSubQueryArgs(query.RuleGroups)
			q = q.Where(fmt.Sprintf("rule_group IN (%s)", strings.Join(in, ",")), args...)
			for _, group := range query.RuleGroups {
				groupsMap[group] = struct{}{}
			}
		}

		if query.ReceiverName != "" {
			q, err = st.filterByContentInNotificationSettings(query.ReceiverName, q)
			if err != nil {
				return err
			}
		}

		if query.TimeIntervalName != "" {
			q, err = st.filterByContentInNotificationSettings(query.TimeIntervalName, q)
			if err != nil {
				return err
			}
		}

		q = q.Asc("namespace_uid", "rule_group", "rule_group_idx", "id")

		alertRules := make([]*ngmodels.AlertRule, 0)
		rule := new(alertRule)
		rows, err := q.Rows(rule)
		if err != nil {
			return err
		}
		defer func() {
			_ = rows.Close()
		}()

		// Deserialize each rule separately in case any of them contain invalid JSON.
		for rows.Next() {
			rule := new(alertRule)
			err = rows.Scan(rule)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, ignoring it", "func", "ListAlertRules", "error", err)
				continue
			}
			converted, err := alertRuleToModelsAlertRule(*rule, st.Logger)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, cannot convert, ignoring it", "func", "ListAlertRules", "error", err)
				continue
			}
			if query.ReceiverName != "" { // remove false-positive hits from the result
				if !slices.ContainsFunc(converted.NotificationSettings, func(settings ngmodels.NotificationSettings) bool {
					return settings.Receiver == query.ReceiverName
				}) {
					continue
				}
			}
			if query.TimeIntervalName != "" {
				if !slices.ContainsFunc(converted.NotificationSettings, func(settings ngmodels.NotificationSettings) bool {
					return slices.Contains(settings.MuteTimeIntervals, query.TimeIntervalName)
				}) {
					continue
				}
			}
			// MySQL (and potentially other databases) can use case-insensitive comparison.
			// This code makes sure we return groups that only exactly match the filter.
			if groupsMap != nil {
				if _, ok := groupsMap[converted.RuleGroup]; !ok {
					continue
				}
			}
			alertRules = append(alertRules, &converted)
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
		args := make([]any, 0)
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
		ruleGroups := make([]alertRule, 0)
		err := sess.Find(
			&ruleGroups,
			alertRule{OrgID: orgID, RuleGroup: ruleGroup, NamespaceUID: namespaceUID},
		)
		if len(ruleGroups) == 0 {
			return ngmodels.ErrAlertRuleGroupNotFound.Errorf("")
		}
		interval = ruleGroups[0].IntervalSeconds
		return err
	})
}

// GetUserVisibleNamespaces returns the folders that are visible to the user
func (st DBstore) GetUserVisibleNamespaces(ctx context.Context, orgID int64, user identity.Requester) (map[string]*folder.Folder, error) {
	folders, err := st.FolderService.GetFolders(ctx, folder.GetFoldersQuery{
		OrgID:        orgID,
		WithFullpath: true,
		SignedInUser: user,
	})
	if err != nil {
		return nil, err
	}

	namespaceMap := make(map[string]*folder.Folder)
	for _, f := range folders {
		namespaceMap[f.UID] = f
	}
	return namespaceMap, nil
}

// GetNamespaceByUID is a handler for retrieving a namespace by its UID. Alerting rules follow a Grafana folder-like structure which we call namespaces.
func (st DBstore) GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error) {
	f, err := st.FolderService.GetFolders(ctx, folder.GetFoldersQuery{OrgID: orgID, UIDs: []string{uid}, WithFullpath: true, SignedInUser: user})
	if err != nil {
		return nil, err
	}
	if len(f) == 0 {
		return nil, dashboards.ErrFolderAccessDenied
	}
	return f[0], nil
}

func (st DBstore) GetAlertRulesKeysForScheduling(ctx context.Context) ([]ngmodels.AlertRuleKeyWithVersion, error) {
	var result []ngmodels.AlertRuleKeyWithVersion
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		alertRulesSql := sess.Table("alert_rule").Select("org_id, uid, version")
		var disabledOrgs []int64

		for orgID := range st.Cfg.DisabledOrgs {
			disabledOrgs = append(disabledOrgs, orgID)
		}

		if len(disabledOrgs) > 0 {
			alertRulesSql = alertRulesSql.NotIn("org_id", disabledOrgs)
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
	var rules []*ngmodels.AlertRule
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		var disabledOrgs []int64
		for orgID := range st.Cfg.DisabledOrgs {
			disabledOrgs = append(disabledOrgs, orgID)
		}

		alertRulesSql := sess.Table("alert_rule")
		if len(disabledOrgs) > 0 {
			alertRulesSql.NotIn("org_id", disabledOrgs)
		}

		var groupsMap map[string]struct{}
		if len(query.RuleGroups) > 0 {
			alertRulesSql.In("rule_group", query.RuleGroups)
			groupsMap = make(map[string]struct{}, len(query.RuleGroups))
			for _, group := range query.RuleGroups {
				groupsMap[group] = struct{}{}
			}
		}

		rule := new(alertRule)
		rows, err := alertRulesSql.Rows(rule)
		if err != nil {
			return fmt.Errorf("failed to fetch alert rules: %w", err)
		}
		defer func() {
			if err := rows.Close(); err != nil {
				st.Logger.Error("Unable to close rows session", "error", err)
			}
		}()
		// Deserialize each rule separately in case any of them contain invalid JSON.
		for rows.Next() {
			rule := new(alertRule)
			err = rows.Scan(rule)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, ignoring it", "func", "GetAlertRulesForScheduling", "error", err)
				continue
			}
			converted, err := alertRuleToModelsAlertRule(*rule, st.Logger)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, cannot convert it", "func", "GetAlertRulesForScheduling", "error", err)
				continue
			}
			// MySQL (and potentially other databases) uses case-insensitive comparison.
			// This code makes sure we return groups that only exactly match the filter
			if groupsMap != nil {
				if _, ok := groupsMap[converted.RuleGroup]; !ok { // compare groups using case-sensitive logic.
					continue
				}
			}
			if st.FeatureToggles.IsEnabled(ctx, featuremgmt.FlagAlertingQueryOptimization) {
				if optimizations, err := OptimizeAlertQueries(converted.Data); err != nil {
					st.Logger.Error("Could not migrate rule from range to instant query", "rule", rule.UID, "err", err)
				} else if len(optimizations) > 0 {
					st.Logger.Info("Migrated rule from range to instant query", "rule", rule.UID, "migrated_queries", len(optimizations))
				}
			}
			rules = append(rules, &converted)
		}

		query.ResultRules = rules

		if query.PopulateFolders {
			query.ResultFoldersTitles = map[ngmodels.FolderKey]string{}
			uids := map[int64]map[string]struct{}{}
			for _, r := range rules {
				om, ok := uids[r.OrgID]
				if !ok {
					om = make(map[string]struct{})
					uids[r.OrgID] = om
				}
				om[r.NamespaceUID] = struct{}{}
			}
			for orgID, uids := range uids {
				schedulerUser := accesscontrol.BackgroundUser("grafana_scheduler", orgID, org.RoleAdmin,
					[]accesscontrol.Permission{
						{
							Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll,
						},
					})

				folders, err := st.FolderService.GetFolders(ctx, folder.GetFoldersQuery{
					OrgID:        orgID,
					UIDs:         maps.Keys(uids),
					WithFullpath: true,
					SignedInUser: schedulerUser,
				})
				if err != nil {
					return fmt.Errorf("failed to fetch a list of folders that contain alert rules: %w", err)
				}
				for _, f := range folders {
					query.ResultFoldersTitles[ngmodels.FolderKey{OrgID: f.OrgID, UID: f.UID}] = f.Fullpath
				}
			}
		}
		return nil
	})
}

// DeleteInFolder deletes the rules contained in a given folder along with their associated data.
func (st DBstore) DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error {
	for _, folderUID := range folderUIDs {
		evaluator := accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID))
		canSave, err := st.AccessControl.Evaluate(ctx, user, evaluator)
		if err != nil {
			st.Logger.Error("Failed to evaluate access control", "error", err)
			return err
		}
		if !canSave {
			st.Logger.Error("user is not allowed to delete alert rules in folder", "folder", folderUID, "user")
			return dashboards.ErrFolderAccessDenied
		}

		rules, err := st.ListAlertRules(ctx, &ngmodels.ListAlertRulesQuery{
			OrgID:         orgID,
			NamespaceUIDs: []string{folderUID},
		})
		if err != nil {
			return err
		}

		uids := make([]string, 0, len(rules))
		for _, tgt := range rules {
			if tgt != nil {
				uids = append(uids, tgt.UID)
			}
		}

		if err := st.DeleteAlertRulesByUID(ctx, orgID, uids...); err != nil {
			return err
		}
	}
	return nil
}

// Kind returns the name of the alert rule type of entity.
func (st DBstore) Kind() string { return entity.StandardKindAlertRule }

// GenerateNewAlertRuleUID generates a unique UID for a rule.
// This is set as a variable so that the tests can override it.
// The ruleTitle is only used by the mocked functions.
var GenerateNewAlertRuleUID = func(sess *db.Session, orgID int64, ruleTitle string) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&alertRule{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", ngmodels.ErrAlertRuleFailedGenerateUniqueUID
}

// validateAlertRule validates the alert rule including db-level restrictions on field lengths.
func (st DBstore) validateAlertRule(alertRule ngmodels.AlertRule) error {
	if err := alertRule.ValidateAlertRule(st.Cfg); err != nil {
		return err
	}

	// enforce max name length.
	if len(alertRule.Title) > AlertRuleMaxTitleLength {
		return fmt.Errorf("%w: name length should not be greater than %d", ngmodels.ErrAlertRuleFailedValidation, AlertRuleMaxTitleLength)
	}

	// enforce max rule group name length.
	if len(alertRule.RuleGroup) > AlertRuleMaxRuleGroupNameLength {
		return fmt.Errorf("%w: rule group name length should not be greater than %d", ngmodels.ErrAlertRuleFailedValidation, AlertRuleMaxRuleGroupNameLength)
	}

	return nil
}

// ListNotificationSettings fetches all notification settings for given organization
func (st DBstore) ListNotificationSettings(ctx context.Context, q ngmodels.ListNotificationSettingsQuery) (map[ngmodels.AlertRuleKey][]ngmodels.NotificationSettings, error) {
	var rules []alertRule
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		query := sess.Table(alertRule{}).Select("uid, notification_settings").Where("org_id = ?", q.OrgID)
		hasFilter := false
		if q.ReceiverName != "" {
			var err error
			query, err = st.filterByContentInNotificationSettings(q.ReceiverName, query)
			if err != nil {
				return err
			}
			hasFilter = true
		}
		if q.TimeIntervalName != "" {
			var err error
			query, err = st.filterByContentInNotificationSettings(q.TimeIntervalName, query)
			if err != nil {
				return err
			}
			hasFilter = true
		}
		if !hasFilter {
			query = query.And("notification_settings IS NOT NULL AND notification_settings <> 'null' AND notification_settings <> ''")
		}
		return query.Find(&rules)
	})
	if err != nil {
		return nil, err
	}
	result := make(map[ngmodels.AlertRuleKey][]ngmodels.NotificationSettings, len(rules))
	for _, rule := range rules {
		if rule.NotificationSettings == "" {
			continue
		}
		converted, err := parseNotificationSettings(rule.NotificationSettings)
		if err != nil {
			return nil, fmt.Errorf("failed to convert notification settings %s to models: %w", rule.UID, err)
		}
		ns := make([]ngmodels.NotificationSettings, 0, len(rule.NotificationSettings))
		for _, setting := range converted {
			if q.ReceiverName != "" && q.ReceiverName != setting.Receiver { // currently, there can be only one setting. If in future there are more, we will return all settings of a rule that has a setting with receiver
				continue
			}
			if q.TimeIntervalName != "" && !slices.Contains(setting.MuteTimeIntervals, q.TimeIntervalName) {
				continue
			}
			ns = append(ns, setting)
		}
		if len(ns) > 0 {
			key := ngmodels.AlertRuleKey{
				OrgID: q.OrgID,
				UID:   rule.UID,
			}
			result[key] = ns
		}
	}
	return result, nil
}

func (st DBstore) filterByContentInNotificationSettings(value string, sess *xorm.Session) (*xorm.Session, error) {
	if value == "" {
		return sess, nil
	}
	// marshall string according to JSON rules so we follow escaping rules.
	b, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("failed to marshall string for notification settings content filter: %w", err)
	}
	var search = string(b)
	if st.SQLStore.GetDialect().DriverName() != migrator.SQLite {
		// this escapes escaped double quote (\") to \\\"
		search = strings.ReplaceAll(strings.ReplaceAll(search, `\`, `\\`), `"`, `\"`)
	}
	return sess.And(fmt.Sprintf("notification_settings %s ?", st.SQLStore.GetDialect().LikeStr()), "%"+search+"%"), nil
}

func (st DBstore) RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string, validateProvenance func(ngmodels.Provenance) bool, dryRun bool) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error) {
	// fetch entire rules because Update method requires it because it copies rules to version table
	rules, err := st.ListAlertRules(ctx, &ngmodels.ListAlertRulesQuery{
		OrgID:        orgID,
		ReceiverName: oldReceiver,
	})
	if err != nil {
		return nil, nil, err
	}
	if len(rules) == 0 {
		return nil, nil, nil
	}

	provenances, err := st.GetProvenances(ctx, orgID, (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return nil, nil, err
	}

	var invalidProvenance []ngmodels.AlertRuleKey
	result := make([]ngmodels.AlertRuleKey, 0, len(rules))
	updates := make([]ngmodels.UpdateRule, 0, len(rules))
	for _, rule := range rules {
		provenance, ok := provenances[rule.UID]
		if !ok {
			provenance = ngmodels.ProvenanceNone
		}
		if !validateProvenance(provenance) {
			invalidProvenance = append(invalidProvenance, rule.GetKey())
		}
		if len(invalidProvenance) > 0 { // do not do any fixes if there is at least one rule with not allowed provenance
			continue
		}

		result = append(result, rule.GetKey())

		if dryRun {
			continue
		}

		r := ngmodels.CopyRule(rule)
		for idx := range r.NotificationSettings {
			if r.NotificationSettings[idx].Receiver == oldReceiver {
				r.NotificationSettings[idx].Receiver = newReceiver
			}
		}

		updates = append(updates, ngmodels.UpdateRule{
			Existing: rule,
			New:      *r,
		})
	}
	if len(invalidProvenance) > 0 {
		return nil, invalidProvenance, nil
	}
	if dryRun {
		return result, nil, nil
	}
	return result, nil, st.UpdateAlertRules(ctx, updates)
}

// RenameTimeIntervalInNotificationSettings renames all rules that use old time interval name to the new name.
// Before renaming, it checks that all rules that need to be updated have allowed provenance status, and skips updating
// if at least one rule does not have allowed provenance.
// It returns a tuple:
// - a collection of models.AlertRuleKey of rules that were updated,
// - a collection of rules that have invalid provenance status,
// - database error
func (st DBstore) RenameTimeIntervalInNotificationSettings(
	ctx context.Context,
	orgID int64,
	oldTimeInterval, newTimeInterval string,
	validateProvenance func(ngmodels.Provenance) bool,
	dryRun bool,
) ([]ngmodels.AlertRuleKey, []ngmodels.AlertRuleKey, error) {
	// fetch entire rules because Update method requires it because it copies rules to version table
	rules, err := st.ListAlertRules(ctx, &ngmodels.ListAlertRulesQuery{
		OrgID:            orgID,
		TimeIntervalName: oldTimeInterval,
	})
	if err != nil {
		return nil, nil, err
	}
	if len(rules) == 0 {
		return nil, nil, nil
	}

	provenances, err := st.GetProvenances(ctx, orgID, (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		return nil, nil, err
	}

	var invalidProvenance []ngmodels.AlertRuleKey
	result := make([]ngmodels.AlertRuleKey, 0, len(rules))
	updates := make([]ngmodels.UpdateRule, 0, len(rules))
	for _, rule := range rules {
		provenance, ok := provenances[rule.UID]
		if !ok {
			provenance = ngmodels.ProvenanceNone
		}
		if !validateProvenance(provenance) {
			invalidProvenance = append(invalidProvenance, rule.GetKey())
		}
		if len(invalidProvenance) > 0 { // do not do any fixes if there is at least one rule with not allowed provenance
			continue
		}

		result = append(result, rule.GetKey())

		if dryRun {
			continue
		}

		r := ngmodels.CopyRule(rule)
		for idx := range r.NotificationSettings {
			for mtIdx := range r.NotificationSettings[idx].MuteTimeIntervals {
				if r.NotificationSettings[idx].MuteTimeIntervals[mtIdx] == oldTimeInterval {
					r.NotificationSettings[idx].MuteTimeIntervals[mtIdx] = newTimeInterval
				}
			}
		}

		updates = append(updates, ngmodels.UpdateRule{
			Existing: rule,
			New:      *r,
		})
	}
	if len(invalidProvenance) > 0 {
		return nil, invalidProvenance, nil
	}
	if dryRun {
		return result, nil, nil
	}
	return result, nil, st.UpdateAlertRules(ctx, updates)
}

func ruleConstraintViolationToErr(sess *db.Session, rule ngmodels.AlertRule, err error, logger log.Logger) error {
	msg := err.Error()
	if strings.Contains(msg, "UQE_alert_rule_org_id_namespace_uid_title") || strings.Contains(msg, "alert_rule.org_id, alert_rule.namespace_uid, alert_rule.title") {
		// return verbose conflicting alert rule error response
		// see: https://github.com/grafana/grafana/issues/89755
		var fetched_uid string
		var existingPartialAlertRule ngmodels.AlertRule
		ok, uid_fetch_err := sess.Table("alert_rule").Cols("uid").Where("org_id = ? AND title = ? AND namespace_uid = ?", rule.OrgID, rule.Title, rule.NamespaceUID).Get(&fetched_uid)
		if uid_fetch_err != nil {
			logger.Error("Error fetching uid from alert_rule table", "reason", uid_fetch_err.Error())
		}
		if ok {
			existingPartialAlertRule = ngmodels.AlertRule{UID: fetched_uid, Title: rule.Title, NamespaceUID: rule.NamespaceUID}
		}
		return ngmodels.ErrAlertRuleConflictVerbose(existingPartialAlertRule, rule, ngmodels.ErrAlertRuleUniqueConstraintViolation)
	} else if strings.Contains(msg, "UQE_alert_rule_org_id_uid") || strings.Contains(msg, "alert_rule.org_id, alert_rule.uid") {
		// return verbose conflicting alert rule error response
		// see: https://github.com/grafana/grafana/issues/89755
		existingPartialAlertRule := ngmodels.AlertRule{UID: rule.UID}
		return ngmodels.ErrAlertRuleConflictVerbose(existingPartialAlertRule, rule, errors.New("rule UID under the same organisation should be unique"))
	} else {
		return ngmodels.ErrAlertRuleConflict(rule, err)
	}
}

// GetNamespacesByRuleUID returns a map of rule UIDs to their namespace UID.
func (st DBstore) GetNamespacesByRuleUID(ctx context.Context, orgID int64, uids ...string) (map[string]string, error) {
	result := make(map[string]string)
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		var rules []alertRule
		err := sess.Table(alertRule{}).Select("uid, namespace_uid").Where("org_id = ?", orgID).In("uid", uids).Find(&rules)
		if err != nil {
			return err
		}
		for _, rule := range rules {
			result[rule.UID] = rule.NamespaceUID
		}
		return nil
	})
	return result, err
}

func getINSubQueryArgs[T any](inputSlice []T) ([]any, []string) {
	args := make([]any, 0, len(inputSlice))
	in := make([]string, 0, len(inputSlice))
	for _, t := range inputSlice {
		args = append(args, t)
		in = append(in, "?")
	}

	return args, in
}
