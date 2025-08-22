package store

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
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
func (st DBstore) DeleteAlertRulesByUID(ctx context.Context, orgID int64, user *ngmodels.UserUID, permanently bool, ruleUID ...string) error {
	if len(ruleUID) == 0 {
		return nil
	}
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

		rows, err = sess.Table("alert_instance").Where("rule_org_id = ?", orgID).In("rule_uid", ruleUID).Delete(alertRule{})
		if err != nil {
			return err
		}
		logger.Debug("Deleted alert instances", "count", rows)

		rows, err = sess.Table("alert_rule_state").Where("org_id = ?", orgID).In("rule_uid", ruleUID).Delete(alertRule{})
		if err != nil {
			return err
		}
		logger.Debug("Deleted alert rule state", "count", rows)

		var versions []alertRuleVersion
		if st.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertRuleRestore) && st.Cfg.DeletedRuleRetention > 0 && !permanently { // save deleted version only if retention is greater than 0
			versions, err = st.getLatestVersionOfRulesByUID(ctx, orgID, ruleUID)
			if err != nil {
				logger.Error("Failed to get latest version of deleted alert rules. The recovery will not be possible", "error", err)
			}
			for idx := range versions {
				version := &versions[idx]
				version.ID = 0
				version.RuleUID = ""
				version.Created = TimeNow()
				version.CreatedBy = nil
				if user != nil {
					version.CreatedBy = util.Pointer(string(*user))
				}
			}
		}

		rows, err = sess.Table(alertRuleVersion{}).Where("rule_org_id = ?", orgID).In("rule_uid", ruleUID).Delete(alertRule{})
		if err != nil {
			return err
		}
		logger.Debug("Deleted alert rule versions", "count", rows)

		if len(versions) > 0 {
			_, err = sess.Insert(versions)
			if err != nil {
				return fmt.Errorf("failed to persist deleted rule for recovery: %w", err)
			}
			logger.Debug("Inserted alert rule versions for recovery", "count", len(versions))
		}
		return nil
	})
}

func (st DBstore) getLatestVersionOfRulesByUID(ctx context.Context, orgID int64, ruleUIDs []string) ([]alertRuleVersion, error) {
	var result []alertRuleVersion
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		args, in := getINSubQueryArgs(ruleUIDs)
		// take only the latest versions of each rule by GUID
		rows, err := sess.SQL(fmt.Sprintf(`
		SELECT v1.* FROM alert_rule_version AS v1
			INNER JOIN (
			    SELECT rule_guid, MAX(id) AS id
			    FROM alert_rule_version
			    WHERE rule_org_id = ?
			      AND rule_uid IN (%s)
			    GROUP BY rule_guid
			) AS v2 ON v1.rule_guid = v2.rule_guid AND v1.id = v2.id
		`, strings.Join(in, ",")), append([]any{orgID}, args...)...).Rows(new(alertRuleVersion))

		if err != nil {
			return err
		}
		result = make([]alertRuleVersion, 0, len(ruleUIDs))
		for rows.Next() {
			rule := new(alertRuleVersion)
			err = rows.Scan(rule)
			if err != nil {
				st.Logger.Error("Invalid rule version found in DB store, ignoring it", "func", "getLatestVersionOfRulesByUID", "error", err)
				continue
			}
			result = append(result, *rule)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
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

func (st DBstore) GetAlertRuleVersions(ctx context.Context, orgID int64, guid string) ([]*ngmodels.AlertRule, error) {
	alertRules := make([]*ngmodels.AlertRule, 0)
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.Table(new(alertRuleVersion)).Where("rule_org_id = ? AND rule_guid = ?", orgID, guid).Asc("id").Rows(new(alertRuleVersion))
		if err != nil {
			return err
		}
		// Deserialize each rule separately in case any of them contain invalid JSON.
		var previousVersion *alertRuleVersion
		for rows.Next() {
			rule := new(alertRuleVersion)
			err = rows.Scan(rule)
			if err != nil {
				st.Logger.Error("Invalid rule version found in DB store, ignoring it", "func", "GetAlertRuleVersions", "error", err)
				continue
			}
			// skip version that has no diff with previous version
			// this is pretty basic comparison, it may have false negatives
			if previousVersion != nil && previousVersion.EqualSpec(*rule) {
				continue
			}
			converted, err := alertRuleToModelsAlertRule(alertRuleVersionToAlertRule(*rule), st.Logger)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, cannot convert, ignoring it", "func", "GetAlertRuleVersions", "error", err, "version_id", rule.ID)
				continue
			}
			previousVersion = rule
			alertRules = append(alertRules, &converted)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	slices.SortFunc(alertRules, func(a, b *ngmodels.AlertRule) int {
		if a.ID > b.ID {
			return -1
		}
		if a.ID < b.ID {
			return 1
		}
		return 0
	})
	return alertRules, nil
}

// ListDeletedRules retrieves a list of deleted alert rules for the specified organization ID from the database.
// It ensures that only the latest version of each rule is included and filters out invalid or duplicated versions.
// Returns a slice of *models.AlertRule  or an error if the operation fails.
func (st DBstore) ListDeletedRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRule, error) {
	alertRules := make([]*ngmodels.AlertRule, 0)
	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		// take only the latest versions of each rule by GUID
		rows, err := sess.Table(alertRuleVersion{}).Where("rule_org_id = ? AND rule_uid = ''", orgID).Desc("created", "id").Rows(alertRuleVersion{})
		if err != nil {
			return err
		}
		// Deserialize each rule separately in case any of them contain invalid JSON.
		for rows.Next() {
			rule := new(alertRuleVersion)
			err = rows.Scan(rule)
			if err != nil {
				st.Logger.Error("Invalid rule version found in DB store, ignoring it", "func", "GetAlertRuleVersions", "error", err)
				continue
			}
			converted, err := alertRuleToModelsAlertRule(alertRuleVersionToAlertRule(*rule), st.Logger)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, cannot convert, ignoring it", "func", "GetAlertRuleVersions", "error", err, "version_id", rule.ID)
				continue
			}
			alertRules = append(alertRules, &converted)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return alertRules, nil
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
func (st DBstore) InsertAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.AlertRule) ([]ngmodels.AlertRuleKeyWithId, error) {
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
			if err := (&r).PreSave(TimeNow, user); err != nil {
				return err
			}

			converted, err := alertRuleFromModelsAlertRule(r)
			if err != nil {
				return fmt.Errorf("failed to convert alert rule %q to storage model: %w", r.Title, err)
			}

			// assign unique identifier that will identify resource across space and time. The probability of collision is so low that we do not need to check for uniqueness.
			// The unique keys will ensure uniqueness in rule and versions tables
			converted.GUID = uuid.NewString()

			newRules = append(newRules, converted)
			ruleVersions = append(ruleVersions, alertRuleToAlertRuleVersion(converted))
		}
		if len(newRules) > 0 {
			// we have to insert the rules one by one as otherwise we are
			// not able to fetch the inserted id as it's not supported by xorm
			for i := range newRules {
				if _, err := sess.Insert(&newRules[i]); err != nil {
					if st.SQLStore.GetDialect().IsUniqueConstraintViolation(err) {
						return ngmodels.ErrAlertRuleConflict(newRules[i].UID, newRules[i].OrgID, err)
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
func (st DBstore) UpdateAlertRules(ctx context.Context, user *ngmodels.UserUID, rules []ngmodels.UpdateRule) error {
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
			r.New.GUID = r.Existing.GUID
			if err := st.validateAlertRule(r.New); err != nil {
				return err
			}
			if err := (&r.New).PreSave(TimeNow, user); err != nil {
				return err
			}
			converted, err := alertRuleFromModelsAlertRule(r.New)
			if err != nil {
				return fmt.Errorf("failed to convert alert rule %s to storage model: %w", r.New.UID, err)
			}
			// no way to update multiple rules at once
			if updated, err := sess.ID(r.Existing.ID).AllCols().Omit("rule_guid").Update(converted); err != nil || updated == 0 {
				if err != nil {
					if st.SQLStore.GetDialect().IsUniqueConstraintViolation(err) {
						return ngmodels.ErrAlertRuleConflict(r.New.UID, r.New.OrgID, err)
					}
					return fmt.Errorf("failed to update rule [%s] %s: %w", r.New.UID, r.New.Title, err)
				}
				return fmt.Errorf("%w: alert rule UID %s version %d", ErrOptimisticLock, r.New.UID, r.New.Version)
			}
			v := alertRuleToAlertRuleVersion(converted)
			v.Version++
			v.ParentVersion = r.Existing.Version

			// check if there is diff between existing and new, and if no, skip saving version.
			existingConverted, err := alertRuleFromModelsAlertRule(*r.Existing)
			if err != nil || !alertRuleToAlertRuleVersion(existingConverted).EqualSpec(v) {
				ruleVersions = append(ruleVersions, v)
			}

			keys = append(keys, ngmodels.AlertRuleKey{OrgID: r.New.OrgID, UID: r.New.UID})
		}
		if len(ruleVersions) > 0 {
			if _, err := sess.Insert(&ruleVersions); err != nil {
				return fmt.Errorf("failed to create new rule versions: %w", err)
			}
			st.deleteOldAlertRuleVersions(ctx, sess, ruleVersions)
		}
		if len(keys) > 0 {
			_ = st.Bus.Publish(ctx, &RuleChangeEvent{
				RuleKeys: keys,
			})
		}
		return nil
	})
}

func (st DBstore) deleteOldAlertRuleVersions(ctx context.Context, sess *db.Session, versions []alertRuleVersion) {
	if st.Cfg.RuleVersionRecordLimit < 1 {
		return
	}
	logger := st.Logger.FromContext(ctx)
	for _, rv := range versions {
		deleteTo := rv.Version - int64(st.Cfg.RuleVersionRecordLimit)
		// if the last version is less that retention, do nothing
		if deleteTo <= 1 {
			continue
		}
		logger := logger.New("org_id", rv.RuleOrgID, "rule_uid", rv.RuleUID, "version", rv.Version, "limit", st.Cfg.RulesPerRuleGroupLimit)
		res, err := sess.Exec(`DELETE FROM alert_rule_version WHERE rule_guid = ? AND version <= ?`, rv.RuleGUID, deleteTo)
		if err != nil {
			logger.Error("Failed to delete old alert rule versions", "error", err)
			return
		}
		rows, err := res.RowsAffected()
		if err != nil {
			rows = -1
		}
		if rows != 0 {
			logger.Info("Deleted old alert_rule_version(s)", "deleted", rows)
		}
	}
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

func (st DBstore) ListAlertRulesByGroup(ctx context.Context, query *ngmodels.ListAlertRulesByGroupQuery) (result ngmodels.RulesGroup, nextToken string, err error) {
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

		if query.HasPrometheusRuleDefinition != nil {
			q, err = st.filterWithPrometheusRuleDefinition(*query.HasPrometheusRuleDefinition, q)
			if err != nil {
				return err
			}
		}

		switch query.RuleType {
		case ngmodels.RuleTypeFilterAlerting:
			q = q.Where("record = ''")
		case ngmodels.RuleTypeFilterRecording:
			q = q.Where("record != ''")
		case ngmodels.RuleTypeFilterAll:
			// no additional filter
		default:
			return fmt.Errorf("unknown rule type filter %q", query.RuleType)
		}

		// Order by group first, then by rule index within group
		q = q.Asc("namespace_uid", "rule_group", "rule_group_idx", "id")

		var cursor ngmodels.GroupCursor
		if query.GroupContinueToken != "" {
			// only set the cursor if it's valid, otherwise we'll start from the beginning
			if cur, err := ngmodels.DecodeGroupCursor(query.GroupContinueToken); err == nil {
				cursor = cur
			}
		}

		// Build group cursor condition
		if cursor.NamespaceUID != "" {
			q = buildGroupCursorCondition(q, cursor)
		}

		// No arbitrary fetch limit - let the loop control pagination
		alertRules := make([]*ngmodels.AlertRule, 0)
		rule := new(alertRule)
		rows, err := q.Rows(rule)
		if err != nil {
			return err
		}
		defer func() {
			_ = rows.Close()
		}()

		// Process rules and implement per-group pagination
		var groupsFetched int64
		for rows.Next() {
			rule := new(alertRule)
			err = rows.Scan(rule)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, ignoring it", "func", "ListAlertRulesByGroup", "error", err)
				continue
			}

			converted, err := alertRuleToModelsAlertRule(*rule, st.Logger)
			if err != nil {
				st.Logger.Error("Invalid rule found in DB store, cannot convert, ignoring it", "func", "ListAlertRulesByGroup", "error", err)
				continue
			}

			// Check if we've moved to a new group
			key := ngmodels.GroupCursor{
				NamespaceUID: converted.NamespaceUID,
				RuleGroup:    converted.RuleGroup,
			}
			if key != cursor {
				// Check if we've reached the group limit
				if query.GroupLimit > 0 && groupsFetched == query.GroupLimit {
					// Generate next token for the next group
					nextToken = ngmodels.EncodeGroupCursor(cursor)
					break
				}

				// Reset for new group
				cursor = key
				groupsFetched++
			}

			// Apply post-query filters
			if !shouldIncludeRule(&converted, query, groupsMap) {
				continue
			}

			alertRules = append(alertRules, &converted)
		}

		result = alertRules
		return nil
	})
	return result, nextToken, err
}

func buildGroupCursorCondition(sess *xorm.Session, c ngmodels.GroupCursor) *xorm.Session {
	return sess.Where("(namespace_uid > ?)", c.NamespaceUID).
		Or("(namespace_uid = ? AND rule_group > ?)", c.NamespaceUID, c.RuleGroup)
}

func shouldIncludeRule(rule *ngmodels.AlertRule, query *ngmodels.ListAlertRulesByGroupQuery, groupsMap map[string]struct{}) bool {
	if query.ReceiverName != "" {
		if !slices.ContainsFunc(rule.NotificationSettings, func(settings ngmodels.NotificationSettings) bool {
			return settings.Receiver == query.ReceiverName
		}) {
			return false
		}
	}

	if query.TimeIntervalName != "" {
		if !slices.ContainsFunc(rule.NotificationSettings, func(settings ngmodels.NotificationSettings) bool {
			return slices.Contains(settings.MuteTimeIntervals, query.TimeIntervalName) ||
				slices.Contains(settings.ActiveTimeIntervals, query.TimeIntervalName)
		}) {
			return false
		}
	}

	if query.HasPrometheusRuleDefinition != nil {
		if *query.HasPrometheusRuleDefinition != rule.HasPrometheusRuleDefinition() {
			return false
		}
	}

	if groupsMap != nil {
		if _, ok := groupsMap[rule.RuleGroup]; !ok {
			return false
		}
	}

	return true
}

func (st DBstore) ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (result ngmodels.RulesGroup, err error) {
	result, nextToken, err := st.ListAlertRulesPaginated(ctx, &ngmodels.ListAlertRulesExtendedQuery{
		ListAlertRulesQuery: *query,
		ContinueToken:       "",
		Limit:               0,
		RuleType:            ngmodels.RuleTypeFilterAll,
	})
	// This should never happen, as Limit is 0, which means no pagination.
	if nextToken != "" {
		err = fmt.Errorf("unexpected next token %q, expected empty string", nextToken)
		st.Logger.Error("ListAlertRules returned a next token, but it should not have, this is a bug!", "next_token", nextToken, "query", query)
	}
	return result, err
}

// ListAlertRulesPaginated is a handler for retrieving alert rules of specific organization paginated.
func (st DBstore) ListAlertRulesPaginated(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (result ngmodels.RulesGroup, nextToken string, err error) {
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

		if query.HasPrometheusRuleDefinition != nil {
			q, err = st.filterWithPrometheusRuleDefinition(*query.HasPrometheusRuleDefinition, q)
			if err != nil {
				return err
			}
		}

		// FIXME: record is nullable but we don't save it as null when it's nil
		switch query.RuleType {
		case ngmodels.RuleTypeFilterAlerting:
			q = q.Where("record = ''")
		case ngmodels.RuleTypeFilterRecording:
			q = q.Where("record != ''")
		case ngmodels.RuleTypeFilterAll:
			// no additional filter
		default:
			return fmt.Errorf("unknown rule type filter %q", query.RuleType)
		}

		q = q.Asc("namespace_uid", "rule_group", "rule_group_idx", "id")

		if query.ContinueToken != "" {
			cursor, err := decodeCursor(query.ContinueToken)
			if err != nil {
				return fmt.Errorf("invalid continue token: %w", err)
			}

			// Build cursor condition that matches the ORDER BY clause
			q = buildCursorCondition(q, cursor)
		}

		if query.Limit > 0 {
			// Ensure we clamp to the max int available on the platform
			lim := min(query.Limit, math.MaxInt)
			// Fetch one extra rule to determine if there are more results
			q = q.Limit(int(lim) + 1)
		}

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
			converted, ok := st.handleRuleRow(rows, query, groupsMap)
			if ok {
				alertRules = append(alertRules, converted)
			}
		}

		genToken := query.Limit > 0 && len(alertRules) > int(query.Limit)
		if genToken {
			// Remove the extra item we fetched
			alertRules = alertRules[:query.Limit]

			// Generate next continue token from the last item
			lastRule := alertRules[len(alertRules)-1]
			cursor := continueCursor{
				NamespaceUID: lastRule.NamespaceUID,
				RuleGroup:    lastRule.RuleGroup,
				RuleGroupIdx: int64(lastRule.RuleGroupIndex),
				ID:           lastRule.ID,
			}

			nextToken = encodeCursor(cursor)
		}

		result = alertRules
		return nil
	})
	return result, nextToken, err
}

func (st DBstore) handleRuleRow(rows *xorm.Rows, query *ngmodels.ListAlertRulesExtendedQuery, groupsSet map[string]struct{}) (*ngmodels.AlertRule, bool) {
	rule := new(alertRule)
	err := rows.Scan(rule)
	if err != nil {
		st.Logger.Error("Invalid rule found in DB store, ignoring it", "func", "ListAlertRules", "error", err)
		return nil, false
	}
	converted, err := alertRuleToModelsAlertRule(*rule, st.Logger)
	if err != nil {
		st.Logger.Error("Invalid rule found in DB store, cannot convert, ignoring it", "func", "ListAlertRules", "error", err)
		return nil, false
	}
	if query.ReceiverName != "" { // remove false-positive hits from the result
		if !slices.ContainsFunc(converted.NotificationSettings, func(settings ngmodels.NotificationSettings) bool {
			return settings.Receiver == query.ReceiverName
		}) {
			return nil, false
		}
	}
	if query.TimeIntervalName != "" {
		if !slices.ContainsFunc(converted.NotificationSettings, func(settings ngmodels.NotificationSettings) bool {
			return slices.Contains(settings.MuteTimeIntervals, query.TimeIntervalName) || slices.Contains(settings.ActiveTimeIntervals, query.TimeIntervalName)
		}) {
			return nil, false
		}
	}
	if query.HasPrometheusRuleDefinition != nil { // remove false-positive hits from the result
		if *query.HasPrometheusRuleDefinition != converted.HasPrometheusRuleDefinition() {
			return nil, false
		}
	}
	// MySQL (and potentially other databases) can use case-insensitive comparison.
	// This code makes sure we return groups that only exactly match the filter.
	if groupsSet != nil {
		if _, ok := groupsSet[converted.RuleGroup]; !ok {
			return nil, false
		}
	}
	return &converted, true
}

type continueCursor struct {
	NamespaceUID string `json:"n"`
	RuleGroup    string `json:"g"`
	RuleGroupIdx int64  `json:"i"`
	ID           int64  `json:"d"`
}

func encodeCursor(c continueCursor) string {
	data, _ := json.Marshal(c)
	return base64.URLEncoding.EncodeToString(data)
}

func decodeCursor(token string) (continueCursor, error) {
	var c continueCursor
	data, err := base64.URLEncoding.DecodeString(token)
	if err != nil {
		return c, fmt.Errorf("failed to decode token: %w", err)
	}

	if err := json.Unmarshal(data, &c); err != nil {
		return c, fmt.Errorf("failed to unmarshal cursor: %w", err)
	}

	return c, nil
}

func buildCursorCondition(sess *xorm.Session, c continueCursor) *xorm.Session {
	return sess.Where("(namespace_uid > ?)", c.NamespaceUID).
		Or("(namespace_uid = ? AND rule_group > ?)", c.NamespaceUID, c.RuleGroup).
		Or("(namespace_uid = ? AND rule_group = ? AND rule_group_idx > ?)", c.NamespaceUID, c.RuleGroup, c.RuleGroupIdx).
		Or("(namespace_uid = ? AND rule_group = ? AND rule_group_idx = ? AND id > ?)", c.NamespaceUID, c.RuleGroup, c.RuleGroupIdx, c.ID)
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

		if err := st.DeleteAlertRulesByUID(ctx, orgID, ngmodels.NewUserUID(user), false, uids...); err != nil {
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
			if q.TimeIntervalName != "" && !slices.Contains(setting.MuteTimeIntervals, q.TimeIntervalName) && !slices.Contains(setting.ActiveTimeIntervals, q.TimeIntervalName) {
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
	sql, param := st.SQLStore.GetDialect().LikeOperator("notification_settings", true, search, true)
	return sess.And(sql, param), nil
}

func (st DBstore) filterWithPrometheusRuleDefinition(value bool, sess *xorm.Session) (*xorm.Session, error) {
	if value {
		// Filter for rules that have both prometheus_style_rule and original_rule_definition in metadata
		return sess.And(
			"metadata LIKE ? AND metadata LIKE ?",
			"%prometheus_style_rule%",
			"%original_rule_definition%",
		), nil
	}
	// Filter for rules that don't have prometheus_style_rule and original_rule_definition in metadata
	return sess.And(
		"metadata NOT LIKE ? AND metadata NOT LIKE ?",
		"%prometheus_style_rule%",
		"%original_rule_definition%",
	), nil
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

		r := rule.Copy()
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
	// Provide empty user identifier to ensure it's clear that the rule update was made by the system
	// and not by the user who changed the receiver's title.
	return result, nil, st.UpdateAlertRules(ctx, &ngmodels.AlertingUserUID, updates)
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

		r := rule.Copy()
		for idx := range r.NotificationSettings {
			for mtIdx := range r.NotificationSettings[idx].MuteTimeIntervals {
				if r.NotificationSettings[idx].MuteTimeIntervals[mtIdx] == oldTimeInterval {
					r.NotificationSettings[idx].MuteTimeIntervals[mtIdx] = newTimeInterval
				}
			}
			for mtIdx := range r.NotificationSettings[idx].ActiveTimeIntervals {
				if r.NotificationSettings[idx].ActiveTimeIntervals[mtIdx] == oldTimeInterval {
					r.NotificationSettings[idx].ActiveTimeIntervals[mtIdx] = newTimeInterval
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
	// Provide empty user identifier to ensure it's clear that the rule update was made by the system
	// and not by the user who changed the receiver's title.
	return result, nil, st.UpdateAlertRules(ctx, &ngmodels.AlertingUserUID, updates)
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

func (st DBstore) CleanUpDeletedAlertRules(ctx context.Context) (int64, error) {
	affectedRows := int64(-1)
	err := st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		expire := TimeNow().Add(-st.Cfg.DeletedRuleRetention)
		st.Logger.Debug("Permanently remove expired deleted rules", "deletedBefore", expire)
		result, err := sess.Exec("DELETE FROM alert_rule_version WHERE rule_uid='' AND created <= ?", expire)
		if err != nil {
			return err
		}
		affectedRows, err = result.RowsAffected()
		if err != nil {
			st.Logger.Warn("Failed to get rows affected by the delete operation", "error", err)
		}
		return nil
	})
	return affectedRows, err
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

func (st DBstore) DeleteRuleFromTrashByGUID(ctx context.Context, orgID int64, ruleGUID string) (int64, error) {
	affectedRows := int64(-1)
	err := st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		st.Logger.FromContext(ctx).Debug("Deleting a deleted rule by GUID", "ruleGUID", ruleGUID)
		result, err := sess.Exec("DELETE FROM alert_rule_version WHERE rule_uid='' AND rule_org_id = ? AND rule_guid = ? ", orgID, ruleGUID)
		if err != nil {
			return err
		}
		affectedRows, err = result.RowsAffected()
		if err != nil {
			st.Logger.FromContext(ctx).Warn("Failed to get rows affected by the delete operation", "error", err)
		}
		return nil
	})
	return affectedRows, err
}
