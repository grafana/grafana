package search

import (
	"bytes"
	"fmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"strings"
)

type Builder struct {
	Filters []interface{}
	Dialect migrator.Dialect

	params []interface{}
	sql    bytes.Buffer
}

// ToSql builds the sql and returns it as a string, together with the params.
func (b *Builder) ToSql(limit, page int64) (string, []interface{}) {
	b.params = make([]interface{}, 0)
	b.sql = bytes.Buffer{}

	b.buildSelect()

	b.sql.WriteString("( ")
	// FIXME Add permissions filter
	b.applyFilters()

	b.sql.WriteString(b.Dialect.LimitOffset(limit, (page-1)*limit) + `) as ids
		INNER JOIN dashboard on ids.id = dashboard.id
	`)

	b.sql.WriteString(`
		LEFT OUTER JOIN dashboard folder on folder.id = dashboard.folder_id
		LEFT OUTER JOIN dashboard_tag on dashboard.id = dashboard_tag.dashboard_id`)

	return b.sql.String(), b.params
}

func (b *Builder) buildSelect() {
	b.sql.WriteString(
		`SELECT
			dashboard.id,
			dashboard.uid,
			dashboard.title,
			dashboard.slug,
			dashboard_tag.term,
			dashboard.is_folder,
			dashboard.folder_id,
			folder.uid as folder_uid,
			folder.slug as folder_slug,
			folder.title as folder_title
		FROM `)
}

func (b *Builder) applyFilters() {
	joins := []string{}

	wheres := []string{}
	whereParams := []interface{}{}

	groups := []string{}
	groupParams := []interface{}{}

	orders := []string{}

	for _, f := range b.Filters {
		if f, ok := f.(filterLeftJoin); ok {
			joins = append(joins, fmt.Sprintf(" LEFT OUTER JOIN %s ", f.LeftJoinClause()))
		}

		if f, ok := f.(filterWhere); ok {
			sql, params := f.WhereClause()
			if sql != "" {
				wheres = append(wheres, sql)
				whereParams = append(whereParams, params...)
			}
		}

		if f, ok := f.(filterGroupBy); ok {
			sql, params := f.GroupByClause()
			if sql != "" {
				groups = append(groups, sql)
				groupParams = append(groupParams, params...)
			}
		}

		if f, ok := f.(filterOrderBy); ok {
			orders = append(orders, f.OrderByClause())
		}
	}

	b.sql.WriteString("SELECT dashboard.id FROM dashboard")
	b.sql.WriteString(strings.Join(joins, ""))

	if len(wheres) > 0 {
		b.sql.WriteString(fmt.Sprintf(" WHERE %s", strings.Join(wheres, " AND ")))
		b.params = append(b.params, whereParams...)
	}

	if len(groups) > 0 {
		b.sql.WriteString(fmt.Sprintf(" GROUP BY %s", strings.Join(groups, ", ")))
		b.params = append(b.params, groupParams...)
	}

	if len(orders) > 0 {
		b.sql.WriteString(fmt.Sprintf(" ORDER BY %s", strings.Join(orders, ", ")))
	}
}
