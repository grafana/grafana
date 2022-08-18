package sqlstore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
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

type SQLAnnotationRepo struct {
	sql *SQLStore
}

func NewSQLAnnotationRepo(sql *SQLStore) SQLAnnotationRepo {
	return SQLAnnotationRepo{sql: sql}
}

func (r *SQLAnnotationRepo) Save(item *annotations.Item) error {
	return r.sql.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		tags := models.ParseTagPairs(item.Tags)
		item.Tags = models.JoinTagPairs(tags)
		item.Created = timeNow().UnixNano() / int64(time.Millisecond)
		item.Updated = item.Created
		if item.Epoch == 0 {
			item.Epoch = item.Created
		}
		if err := validateTimeRange(item); err != nil {
			return err
		}

		if _, err := sess.Table("annotation").Insert(item); err != nil {
			return err
		}

		if item.Tags != nil {
			tags, err := EnsureTagsExist(sess, tags)
			if err != nil {
				return err
			}
			for _, tag := range tags {
				if _, err := sess.Exec("INSERT INTO annotation_tag (annotation_id, tag_id) VALUES(?,?)", item.Id, tag.Id); err != nil {
					return err
				}
			}
		}

		return nil
	})
}

func (r *SQLAnnotationRepo) Update(ctx context.Context, item *annotations.Item) error {
	return r.sql.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var (
			isExist bool
			err     error
		)
		existing := new(annotations.Item)

		isExist, err = sess.Table("annotation").Where("id=? AND org_id=?", item.Id, item.OrgId).Get(existing)

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

		if err := validateTimeRange(existing); err != nil {
			return err
		}

		if item.Tags != nil {
			tags, err := EnsureTagsExist(sess, models.ParseTagPairs(item.Tags))
			if err != nil {
				return err
			}
			if _, err := sess.Exec("DELETE FROM annotation_tag WHERE annotation_id = ?", existing.Id); err != nil {
				return err
			}
			for _, tag := range tags {
				if _, err := sess.Exec("INSERT INTO annotation_tag (annotation_id, tag_id) VALUES(?,?)", existing.Id, tag.Id); err != nil {
					return err
				}
			}
		}

		existing.Tags = item.Tags

		_, err = sess.Table("annotation").ID(existing.Id).Cols("epoch", "text", "epoch_end", "updated", "tags").Update(existing)
		return err
	})
}

func (r *SQLAnnotationRepo) Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	var sql bytes.Buffer
	params := make([]interface{}, 0)
	items := make([]*annotations.ItemDTO, 0)
	err := r.sql.WithDbSession(ctx, func(sess *DBSession) error {
		sql.WriteString(`
			SELECT
				annotation.id,
				annotation.epoch as time,
				annotation.epoch_end as time_end,
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
				alert.name as alert_name
			FROM annotation
			LEFT OUTER JOIN ` + dialect.Quote("user") + ` as usr on usr.id = annotation.user_id
			LEFT OUTER JOIN alert on alert.id = annotation.alert_id
			INNER JOIN (
				SELECT a.id from annotation a
			`)

		sql.WriteString(`WHERE a.org_id = ?`)
		params = append(params, query.OrgId)

		if query.AnnotationId != 0 {
			// fmt.Print("annotation query")
			sql.WriteString(` AND a.id = ?`)
			params = append(params, query.AnnotationId)
		}

		if query.AlertId != 0 {
			sql.WriteString(` AND a.alert_id = ?`)
			params = append(params, query.AlertId)
		}

		if query.DashboardId != 0 {
			sql.WriteString(` AND a.dashboard_id = ?`)
			params = append(params, query.DashboardId)
		}

		if query.PanelId != 0 {
			sql.WriteString(` AND a.panel_id = ?`)
			params = append(params, query.PanelId)
		}

		if query.UserId != 0 {
			sql.WriteString(` AND a.user_id = ?`)
			params = append(params, query.UserId)
		}

		if query.From > 0 && query.To > 0 {
			sql.WriteString(` AND a.epoch <= ? AND a.epoch_end >= ?`)
			params = append(params, query.To, query.From)
		}

		if query.Type == "alert" {
			sql.WriteString(` AND a.alert_id > 0`)
		} else if query.Type == "annotation" {
			sql.WriteString(` AND a.alert_id = 0`)
		}

		if len(query.Tags) > 0 {
			keyValueFilters := []string{}

			tags := models.ParseTagPairs(query.Tags)
			for _, tag := range tags {
				if tag.Value == "" {
					keyValueFilters = append(keyValueFilters, "(tag."+dialect.Quote("key")+" = ?)")
					params = append(params, tag.Key)
				} else {
					keyValueFilters = append(keyValueFilters, "(tag."+dialect.Quote("key")+" = ? AND tag."+dialect.Quote("value")+" = ?)")
					params = append(params, tag.Key, tag.Value)
				}
			}

			if len(tags) > 0 {
				tagsSubQuery := fmt.Sprintf(`
			SELECT SUM(1) FROM annotation_tag at
			INNER JOIN tag on tag.id = at.tag_id
			WHERE at.annotation_id = a.id
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

		if !ac.IsDisabled(r.sql.Cfg) {
			acFilter, acArgs, err := getAccessControlFilter(query.SignedInUser)
			if err != nil {
				return err
			}
			sql.WriteString(fmt.Sprintf(" AND (%s)", acFilter))
			params = append(params, acArgs...)
		}

		if query.Limit == 0 {
			query.Limit = 100
		}

		// order of ORDER BY arguments match the order of a sql index for performance
		sql.WriteString(" ORDER BY a.org_id, a.epoch_end DESC, a.epoch DESC" + dialect.Limit(query.Limit) + " ) dt on dt.id = annotation.id")

		if err := sess.SQL(sql.String(), params...).Find(&items); err != nil {
			items = nil
			return err
		}
		return nil
	},
	)

	return items, err
}

func getAccessControlFilter(user *user.SignedInUser) (string, []interface{}, error) {
	if user == nil || user.Permissions[user.OrgID] == nil {
		return "", nil, errors.New("missing permissions")
	}
	scopes, has := user.Permissions[user.OrgID][ac.ActionAnnotationsRead]
	if !has {
		return "", nil, errors.New("missing permissions")
	}
	types, hasWildcardScope := ac.ParseScopes(ac.ScopeAnnotationsProvider.GetResourceScopeType(""), scopes)
	if hasWildcardScope {
		types = map[interface{}]struct{}{annotations.Dashboard.String(): {}, annotations.Organization.String(): {}}
	}

	var filters []string
	var params []interface{}
	for t := range types {
		// annotation read permission with scope annotations:type:organization allows listing annotations that are not associated with a dashboard
		if t == annotations.Organization.String() {
			filters = append(filters, "a.dashboard_id = 0")
		}
		// annotation read permission with scope annotations:type:dashboard allows listing annotations from dashboards which the user can view
		if t == annotations.Dashboard.String() {
			dashboardFilter, dashboardParams := permissions.NewAccessControlDashboardPermissionFilter(user, models.PERMISSION_VIEW, searchstore.TypeDashboard).Where()
			filter := fmt.Sprintf("a.dashboard_id IN(SELECT id FROM dashboard WHERE %s)", dashboardFilter)
			filters = append(filters, filter)
			params = dashboardParams
		}
	}
	return strings.Join(filters, " OR "), params, nil
}

func (r *SQLAnnotationRepo) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return r.sql.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var (
			sql        string
			annoTagSQL string
		)

		sqlog.Info("delete", "orgId", params.OrgId)
		if params.Id != 0 {
			annoTagSQL = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE id = ? AND org_id = ?)"
			sql = "DELETE FROM annotation WHERE id = ? AND org_id = ?"

			if _, err := sess.Exec(annoTagSQL, params.Id, params.OrgId); err != nil {
				return err
			}

			if _, err := sess.Exec(sql, params.Id, params.OrgId); err != nil {
				return err
			}
		} else {
			annoTagSQL = "DELETE FROM annotation_tag WHERE annotation_id IN (SELECT id FROM annotation WHERE dashboard_id = ? AND panel_id = ? AND org_id = ?)"
			sql = "DELETE FROM annotation WHERE dashboard_id = ? AND panel_id = ? AND org_id = ?"

			if _, err := sess.Exec(annoTagSQL, params.DashboardId, params.PanelId, params.OrgId); err != nil {
				return err
			}

			if _, err := sess.Exec(sql, params.DashboardId, params.PanelId, params.OrgId); err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *SQLAnnotationRepo) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	var items []*annotations.Tag
	err := r.sql.WithDbSession(ctx, func(dbSession *DBSession) error {
		if query.Limit == 0 {
			query.Limit = 100
		}

		var sql bytes.Buffer
		params := make([]interface{}, 0)
		tagKey := `tag.` + dialect.Quote("key")
		tagValue := `tag.` + dialect.Quote("value")

		sql.WriteString(`
		SELECT
			` + tagKey + `,
			` + tagValue + `,
			count(*) as count
		FROM tag
		INNER JOIN annotation_tag ON tag.id = annotation_tag.tag_id
`)

		sql.WriteString(`WHERE EXISTS(SELECT 1 FROM annotation WHERE annotation.id = annotation_tag.annotation_id AND annotation.org_id = ?)`)
		params = append(params, query.OrgID)

		sql.WriteString(` AND (` + tagKey + ` ` + dialect.LikeStr() + ` ? OR ` + tagValue + ` ` + dialect.LikeStr() + ` ?)`)
		params = append(params, `%`+query.Tag+`%`, `%`+query.Tag+`%`)

		sql.WriteString(` GROUP BY ` + tagKey + `,` + tagValue)
		sql.WriteString(` ORDER BY ` + tagKey + `,` + tagValue)
		sql.WriteString(` ` + dialect.Limit(query.Limit))

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
