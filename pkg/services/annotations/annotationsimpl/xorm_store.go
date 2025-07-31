package annotationsimpl

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/setting"
)

// Update the item so that EpochEnd >= Epoch
func validateTimeRange(item *annotations.Item) error {
	if item.EpochEnd == 0 {
		if item.Epoch == 0 {
			return annotations.ErrTimerangeMissing
		}
		item.EpochEnd = item.Epoch
	}
	if item.Epoch == 0 {
		item.Epoch = item.EpochEnd
	}
	if item.EpochEnd < item.Epoch {
		item.Epoch, item.EpochEnd = item.EpochEnd, item.Epoch
	}
	return nil
}

type xormRepositoryImpl struct {
	settingsProvider setting.SettingsProvider
	db               db.DB
	log              log.Logger
	tagService       tag.Service
}

func NewXormStore(settingsProvider setting.SettingsProvider, l log.Logger, db db.DB, tagService tag.Service) *xormRepositoryImpl {
	// populate dashboard_uid at startup, to ensure safe downgrades & upgrades after
	// the initial migration occurs
	err := migrations.RunDashboardUIDMigrations(db.GetEngine().NewSession(), db.GetEngine().DriverName())
	if err != nil {
		l.Error("failed to populate dashboard_uid for annotations", "error", err)
	}

	return &xormRepositoryImpl{
		settingsProvider: settingsProvider,
		db:               db,
		log:              l,
		tagService:       tagService,
	}
}

func (r *xormRepositoryImpl) Type() string {
	return "sql"
}

func (r *xormRepositoryImpl) Add(ctx context.Context, item *annotations.Item) error {
	tags := tag.ParseTagPairs(item.Tags)
	item.Tags = tag.JoinTagPairs(tags)
	item.Created = timeNow().UnixNano() / int64(time.Millisecond)
	item.Updated = item.Created
	if item.Epoch == 0 {
		item.Epoch = item.Created
	}
	if err := r.validateItem(item); err != nil {
		return err
	}

	return r.db.WithDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Table("annotation").Insert(item); err != nil {
			return err
		}
		return r.ensureTags(ctx, item.ID, item.Tags)
	})
}

// AddMany inserts large batches of annotations at once.
// It does not return IDs associated with created annotations, and it does not support annotations with tags. If you need this functionality, use the single-item Add instead.
// This is due to a limitation with some supported databases:
// We cannot correlate the IDs of batch-inserted records without acquiring a full table lock in MySQL.
// Annotations have no other uniquifier field, so we also cannot re-query for them after the fact.
// So, callers can only reliably use this endpoint if they don't care about returned IDs.
func (r *xormRepositoryImpl) AddMany(ctx context.Context, items []annotations.Item) error {
	hasTags := make([]annotations.Item, 0)
	hasNoTags := make([]annotations.Item, 0)
	if len(items) == 0 {
		return nil
	}
	for i := range items {
		// The validation logic needs to work in terms of pointers.
		// So, force everything else to work in terms of pointers too, to avoid any implicit extra copying.
		item := &items[i]
		tags := tag.ParseTagPairs(item.Tags)
		item.Tags = tag.JoinTagPairs(tags)
		item.Created = timeNow().UnixNano() / int64(time.Millisecond)
		item.Updated = item.Created
		if item.Epoch == 0 {
			item.Epoch = item.Created
		}
		if err := r.validateItem(item); err != nil {
			return err
		}

		if len(item.Tags) > 0 {
			hasTags = append(hasTags, *item)
		} else {
			hasNoTags = append(hasNoTags, *item)
		}
	}

	return r.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// We can batch-insert every annotation with no tags. If an annotation has tags, we need the ID.
		opts := sqlstore.NativeSettingsForDialect(r.db.GetDialect())
		if _, err := sess.BulkInsert("annotation", hasNoTags, opts); err != nil {
			return err
		}

		for i, item := range hasTags {
			if _, err := sess.Table("annotation").Insert(item); err != nil {
				return err
			}
			itemWithID := &hasTags[i]
			if err := r.ensureTags(ctx, itemWithID.ID, itemWithID.Tags); err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *xormRepositoryImpl) Update(ctx context.Context, item *annotations.Item) error {
	return r.db.InTransaction(ctx, func(ctx context.Context) error {
		return r.update(ctx, item)
	})
}

func (r *xormRepositoryImpl) update(ctx context.Context, item *annotations.Item) error {
	return r.db.WithDbSession(ctx, func(sess *db.Session) error {
		var (
			isExist bool
			err     error
		)
		existing := new(annotations.Item)

		isExist, err = sess.Table("annotation").Where("id=? AND org_id=?", item.ID, item.OrgID).Get(existing)
		if err != nil {
			return err
		}
		if !isExist {
			return errors.New("annotation not found")
		}

		existing.Updated = timeNow().UnixNano() / int64(time.Millisecond)
		existing.Text = item.Text

		if item.Epoch != 0 {
			existing.Epoch = item.Epoch
		}
		if item.EpochEnd != 0 {
			existing.EpochEnd = item.EpochEnd
		}

		if item.Data != nil {
			existing.Data = item.Data
		}

		if item.Tags != nil {
			err := r.ensureTags(ctx, existing.ID, item.Tags)
			if err != nil {
				return err
			}
		}

		existing.Tags = item.Tags

		if err := r.validateItem(existing); err != nil {
			return err
		}

		_, err = sess.Table("annotation").ID(existing.ID).Cols("epoch", "text", "epoch_end", "updated", "tags", "data").Update(existing)
		return err
	})
}

func (r *xormRepositoryImpl) ensureTags(ctx context.Context, annotationID int64, tags []string) error {
	return r.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var tagsInsert []annotationTag
		var tagsDelete []int64

		expectedTags, err := r.tagService.EnsureTagsExist(ctx, tag.ParseTagPairs(tags))
		if err != nil {
			return err
		}
		expected := tagSet(func(t *tag.Tag) int64 {
			return t.Id
		}, expectedTags)

		existingTags := make([]annotationTag, 0)
		if err := sess.SQL("SELECT annotation_id, tag_id FROM annotation_tag WHERE annotation_id = ?", annotationID).Find(&existingTags); err != nil {
			return err
		}
		existing := tagSet(func(t annotationTag) int64 {
			return t.TagID
		}, existingTags)

		for t := range expected {
			if _, exists := existing[t]; !exists {
				tagsInsert = append(tagsInsert, annotationTag{
					AnnotationID: annotationID,
					TagID:        t,
				})
			}
		}
		for t := range existing {
			if _, exists := expected[t]; !exists {
				tagsDelete = append(tagsDelete, t)
			}
		}

		if len(tagsDelete) != 0 {
			if _, err := sess.MustCols("annotation_id", "tag_id").In("tag_id", tagsDelete).Delete(annotationTag{AnnotationID: annotationID}); err != nil {
				return err
			}
		}
		if len(tagsInsert) != 0 {
			if _, err := sess.InsertMulti(tagsInsert); err != nil {
				return err
			}
		}
		return nil
	})
}

func tagSet[T any](fn func(T) int64, list []T) map[int64]struct{} {
	set := make(map[int64]struct{}, len(list))
	for _, item := range list {
		set[fn(item)] = struct{}{}
	}
	return set
}

func (r *xormRepositoryImpl) Get(ctx context.Context, query annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	var sql bytes.Buffer
	params := make([]interface{}, 0)
	items := make([]*annotations.ItemDTO, 0)
	err := r.db.WithDbSession(ctx, func(sess *db.Session) error {
		sql.WriteString(`
			SELECT
				annotation.id,
				annotation.epoch as time,
				annotation.epoch_end as time_end,
				annotation.dashboard_uid,
				annotation.dashboard_id,
				annotation.panel_id,
				annotation.new_state,
				annotation.prev_state,
				annotation.alert_id,
				annotation.text,
				annotation.tags,
				annotation.data,
				annotation.created,
				annotation.updated,
				usr.email,
				usr.login,
				r.title as alert_name
			FROM annotation
			LEFT OUTER JOIN ` + r.db.GetDialect().Quote("user") + ` as usr on usr.id = annotation.user_id
			LEFT OUTER JOIN alert_rule as r on r.id = annotation.alert_id
			INNER JOIN (
				SELECT a.id from annotation a
			`)

		sql.WriteString(`WHERE a.org_id = ?`)
		params = append(params, query.OrgID)

		if query.AnnotationID != 0 {
			// fmt.Println("annotation query")
			sql.WriteString(` AND a.id = ?`)
			params = append(params, query.AnnotationID)
		}

		if query.AlertID != 0 {
			sql.WriteString(` AND a.alert_id = ?`)
			params = append(params, query.AlertID)
		} else if query.AlertUID != "" {
			sql.WriteString(` AND a.alert_id = (SELECT id FROM alert_rule WHERE uid = ? and org_id = ?)`)
			params = append(params, query.AlertUID, query.OrgID)
		}

		// nolint: staticcheck
		if query.DashboardID != 0 {
			sql.WriteString(` AND a.dashboard_id = ?`)
			params = append(params, query.DashboardID)
		}

		// note: orgID is already required above
		if query.DashboardUID != "" {
			sql.WriteString(` AND a.dashboard_uid = ?`)
			params = append(params, query.DashboardUID)
		}

		if query.PanelID != 0 {
			sql.WriteString(` AND a.panel_id = ?`)
			params = append(params, query.PanelID)
		}

		if query.UserID != 0 {
			sql.WriteString(` AND a.user_id = ?`)
			params = append(params, query.UserID)
		}

		if query.From > 0 && query.To > 0 {
			sql.WriteString(` AND a.epoch <= ? AND a.epoch_end >= ?`)
			params = append(params, query.To, query.From)
		}

		switch query.Type {
		case "alert":
			sql.WriteString(` AND a.alert_id > 0`)
		case "annotation":
			sql.WriteString(` AND a.alert_id = 0`)
		}

		if len(query.Tags) > 0 {
			keyValueFilters := []string{}

			tags := tag.ParseTagPairs(query.Tags)
			for _, tag := range tags {
				if tag.Value == "" {
					keyValueFilters = append(keyValueFilters, "(tag."+r.db.GetDialect().Quote("key")+" = ?)")
					params = append(params, tag.Key)
				} else {
					keyValueFilters = append(keyValueFilters, "(tag."+r.db.GetDialect().Quote("key")+" = ? AND tag."+r.db.GetDialect().Quote("value")+" = ?)")
					params = append(params, tag.Key, tag.Value)
				}
			}

			if len(tags) > 0 {
				tagsSubQuery := fmt.Sprintf(`
			SELECT SUM(1) FROM annotation_tag `+r.db.Quote("at")+`
			INNER JOIN tag on tag.id = `+r.db.Quote("at")+`.tag_id
			WHERE `+r.db.Quote("at")+`.annotation_id = a.id
				AND (
				%s
				)
		`, strings.Join(keyValueFilters, " OR "))

				if query.MatchAny {
					sql.WriteString(fmt.Sprintf(" AND (%s) > 0 ", tagsSubQuery))
				} else {
					sql.WriteString(fmt.Sprintf(" AND (%s) = %d ", tagsSubQuery, len(tags)))
				}
			}
		}

		acFilter, acParams := r.getAccessControlFilter(query.SignedInUser, accessResources)
		if acFilter != "" {
			sql.WriteString(fmt.Sprintf(" AND (%s)", acFilter))
		}
		params = append(params, acParams...)

		// order of ORDER BY arguments match the order of a sql index for performance
		orderBy := " ORDER BY a.org_id, a.epoch_end DESC, a.epoch DESC"
		if query.Limit > 0 {
			orderBy += r.db.GetDialect().Limit(query.Limit)
		}
		sql.WriteString(orderBy + " ) dt on dt.id = annotation.id")

		if err := sess.SQL(sql.String(), params...).Find(&items); err != nil {
			items = nil
			return err
		}
		return nil
	},
	)

	return items, err
}

func (r *xormRepositoryImpl) getAccessControlFilter(user identity.Requester, accessResources *accesscontrol.AccessResources) (string, []any) {
	if accessResources.SkipAccessControlFilter {
		return "", nil
	}

	var filters []string
	var params []any

	if accessResources.CanAccessOrgAnnotations {
		filters = append(filters, "a.dashboard_id = 0")
	}

	if accessResources.CanAccessDashAnnotations {
		if len(accessResources.Dashboards) == 0 {
			filters = append(filters, "1=0") // empty set
		} else {
			filters = append(filters, fmt.Sprintf("a.dashboard_uid IN (%s)", strings.Repeat("?,", len(accessResources.Dashboards)-1)+"?"))
			for uid := range accessResources.Dashboards {
				params = append(params, uid)
			}
		}
	}

	return strings.Join(filters, " OR "), params
}

func (r *xormRepositoryImpl) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return r.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var (
			sql        string
			annoTagSQL string
		)

		r.log.Info("delete", "orgId", params.OrgID)
		if params.ID != 0 {
			annoTagSQL = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE id = ? AND org_id = ?)"
			sql = "DELETE FROM annotation WHERE id = ? AND org_id = ?"

			if _, err := sess.Exec(annoTagSQL, params.ID, params.OrgID); err != nil {
				return err
			}

			if _, err := sess.Exec(sql, params.ID, params.OrgID); err != nil {
				return err
			}
		} else if params.DashboardUID != "" {
			annoTagSQL = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE dashboard_uid = ? AND panel_id = ? AND org_id = ?)"
			sql = "DELETE FROM annotation WHERE dashboard_uid = ? AND panel_id = ? AND org_id = ?"

			if _, err := sess.Exec(annoTagSQL, params.DashboardUID, params.PanelID, params.OrgID); err != nil {
				return err
			}

			if _, err := sess.Exec(sql, params.DashboardUID, params.PanelID, params.OrgID); err != nil {
				return err
			}
		} else {
			annoTagSQL = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE dashboard_id = ? AND panel_id = ? AND org_id = ?)"
			sql = "DELETE FROM annotation WHERE dashboard_id = ? AND panel_id = ? AND org_id = ?"

			// nolint: staticcheck
			if _, err := sess.Exec(annoTagSQL, params.DashboardID, params.PanelID, params.OrgID); err != nil {
				return err
			}

			// nolint: staticcheck
			if _, err := sess.Exec(sql, params.DashboardID, params.PanelID, params.OrgID); err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *xormRepositoryImpl) GetTags(ctx context.Context, query annotations.TagsQuery) (annotations.FindTagsResult, error) {
	var items []*annotations.Tag
	err := r.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		if query.Limit == 0 {
			query.Limit = 100
		}

		var sql bytes.Buffer
		params := make([]interface{}, 0)
		tagKey := `tag.` + r.db.GetDialect().Quote("key")
		tagValue := `tag.` + r.db.GetDialect().Quote("value")

		sql.WriteString(`
		SELECT
			` + tagKey + `,
			` + tagValue + `,
			count(*) as count
		FROM tag
		INNER JOIN annotation_tag ON tag.id = annotation_tag.tag_id
		INNER JOIN annotation ON annotation.id = annotation_tag.annotation_id
`)

		sql.WriteString(`WHERE annotation.org_id = ?`)
		params = append(params, query.OrgID)

		sql.WriteString(` AND (`)
		s, p := r.db.GetDialect().LikeOperator(tagKey, true, query.Tag, true)
		sql.WriteString(s)
		params = append(params, p)
		sql.WriteString(" OR ")

		s, p = r.db.GetDialect().LikeOperator(tagValue, true, query.Tag, true)
		sql.WriteString(s)
		params = append(params, p)
		sql.WriteString(")")

		sql.WriteString(` GROUP BY ` + tagKey + `,` + tagValue)
		sql.WriteString(` ORDER BY ` + tagKey + `,` + tagValue)
		sql.WriteString(` ` + r.db.GetDialect().Limit(query.Limit))

		err := dbSession.SQL(sql.String(), params...).Find(&items)
		return err
	})
	if err != nil {
		return annotations.FindTagsResult{Tags: []*annotations.TagsDTO{}}, err
	}
	tags := make([]*annotations.TagsDTO, 0)
	for _, item := range items {
		tag := item.Key
		if len(item.Value) > 0 {
			tag = item.Key + ":" + item.Value
		}
		tags = append(tags, &annotations.TagsDTO{
			Tag:   tag,
			Count: item.Count,
		})
	}

	return annotations.FindTagsResult{Tags: tags}, nil
}

func (r *xormRepositoryImpl) validateItem(item *annotations.Item) error {
	if err := validateTimeRange(item); err != nil {
		return err
	}

	if err := r.validateTagsLength(item); err != nil {
		return err
	}
	return nil
}

func (r *xormRepositoryImpl) validateTagsLength(item *annotations.Item) error {
	cfg := r.settingsProvider.Get()
	estimatedTagsLength := 1 // leading: [
	for i, t := range item.Tags {
		if i == 0 {
			estimatedTagsLength += len(t) + 2 // quotes
		} else {
			estimatedTagsLength += len(t) + 3 // leading comma and quotes
		}
	}
	estimatedTagsLength += 1 // trailing: ]
	if estimatedTagsLength > int(cfg.AnnotationMaximumTagsLength) {
		return annotations.ErrBaseTagLimitExceeded.Errorf("tags length (%d) exceeds the maximum allowed (%d): modify the configuration to increase it", estimatedTagsLength, cfg.AnnotationMaximumTagsLength)
	}
	return nil
}

func (r *xormRepositoryImpl) CleanAnnotations(ctx context.Context, cfg setting.AnnotationCleanupSettings, annotationType string) (int64, error) {
	var totalAffected int64
	if cfg.MaxAge > 0 {
		cutoffDate := timeNow().Add(-cfg.MaxAge).UnixNano() / int64(time.Millisecond)
		// Single-statement approaches, specifically ones using batched sub-queries, seem to deadlock with concurrent inserts on MySQL.
		// We have a bounded batch size, so work around this by first loading the IDs into memory and allowing any locks to flush inside each batch.
		// This may under-delete when concurrent inserts happen, but any such annotations will simply be cleaned on the next cycle.
		//
		// We execute the following batched operation repeatedly until either we run out of objects, the context is cancelled, or there is an error.
		affected, err := untilDoneOrCancelled(ctx, func() (int64, error) {
			cfg := r.settingsProvider.Get()
			cond := fmt.Sprintf(`%s AND created < %v ORDER BY id DESC %s`, annotationType, cutoffDate, r.db.GetDialect().Limit(cfg.AnnotationCleanupJobBatchSize))
			ids, err := r.fetchIDs(ctx, "annotation", cond)
			if err != nil {
				return 0, err
			}

			return r.deleteByIDs(ctx, "annotation", ids)
		})
		totalAffected += affected
		if err != nil {
			return totalAffected, err
		}
	}

	if cfg.MaxCount > 0 {
		// Similar strategy as the above cleanup process, to avoid deadlocks.
		affected, err := untilDoneOrCancelled(ctx, func() (int64, error) {
			cond := fmt.Sprintf(`%s ORDER BY id DESC %s`, annotationType, r.db.GetDialect().LimitOffset(r.settingsProvider.Get().AnnotationCleanupJobBatchSize, cfg.MaxCount))
			ids, err := r.fetchIDs(ctx, "annotation", cond)
			if err != nil {
				return 0, err
			}

			return r.deleteByIDs(ctx, "annotation", ids)
		})
		totalAffected += affected
		if err != nil {
			return totalAffected, err
		}
	}

	return totalAffected, nil
}

func (r *xormRepositoryImpl) CleanOrphanedAnnotationTags(ctx context.Context) (int64, error) {
	return untilDoneOrCancelled(ctx, func() (int64, error) {
		cfg := r.settingsProvider.Get()
		cond := fmt.Sprintf(`NOT EXISTS (SELECT 1 FROM annotation a WHERE annotation_id = a.id) %s`, r.db.GetDialect().Limit(cfg.AnnotationCleanupJobBatchSize))
		ids, err := r.fetchIDs(ctx, "annotation_tag", cond)
		if err != nil {
			return 0, err
		}

		return r.deleteByIDs(ctx, "annotation_tag", ids)
	})
}

func (r *xormRepositoryImpl) fetchIDs(ctx context.Context, table, condition string) ([]int64, error) {
	sql := fmt.Sprintf(`SELECT id FROM %s`, table)
	if condition == "" {
		return nil, fmt.Errorf("condition must be supplied; cannot fetch IDs from entire table")
	}
	sql += fmt.Sprintf(` WHERE %s`, condition)
	ids := make([]int64, 0)
	err := r.db.WithDbSession(ctx, func(session *db.Session) error {
		return session.SQL(sql).Find(&ids)
	})
	return ids, err
}

func (r *xormRepositoryImpl) deleteByIDs(ctx context.Context, table string, ids []int64) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	sql := ""
	args := make([]any, 0)

	// SQLite has a parameter limit of 999.
	// If the batch size is bigger than that, and we're on SQLite, we have to put the IDs directly into the statement.
	const sqliteParameterLimit = 999
	cfg := r.settingsProvider.Get()
	if r.db.GetDBType() == migrator.SQLite && cfg.AnnotationCleanupJobBatchSize > sqliteParameterLimit {
		values := fmt.Sprint(ids[0])
		for _, v := range ids[1:] {
			values = fmt.Sprintf("%s, %d", values, v)
		}
		sql = fmt.Sprintf(`DELETE FROM %s WHERE id IN (%s)`, table, values)
	} else {
		placeholders := "?" + strings.Repeat(",?", len(ids)-1)
		sql = fmt.Sprintf(`DELETE FROM %s WHERE id IN (%s)`, table, placeholders)
		args = asAny(ids)
	}

	var affected int64
	err := r.db.WithDbSession(ctx, func(session *db.Session) error {
		res, err := session.Exec(append([]any{sql}, args...)...)
		if err != nil {
			return err
		}
		affected, err = res.RowsAffected()
		return err
	})
	return affected, err
}

func asAny(vs []int64) []any {
	r := make([]any, len(vs))
	for i, v := range vs {
		r[i] = v
	}
	return r
}

// untilDoneOrCancelled repeatedly executes batched work until that work is either done (i.e., returns zero affected objects),
// a batch produces an error, or the provided context is cancelled.
// The work to be done is given as a callback that returns the number of affected objects for each batch, plus that batch's errors.
func untilDoneOrCancelled(ctx context.Context, batchWork func() (int64, error)) (int64, error) {
	var totalAffected int64
	for {
		select {
		case <-ctx.Done():
			return totalAffected, ctx.Err()
		default:
			affected, err := batchWork()
			totalAffected += affected
			if err != nil {
				return totalAffected, err
			}

			if affected == 0 {
				return totalAffected, nil
			}
		}
	}
}

type annotationTag struct {
	AnnotationID int64 `xorm:"annotation_id"`
	TagID        int64 `xorm:"tag_id"`
}
