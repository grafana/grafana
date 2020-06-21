package searchstore

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// Builder defaults to returning a SQL query to get a list of all dashboards
// in default order, but can be modified by applying filters.
type Builder struct {
	// List of FilterWhere/FilterGroupBy/FilterOrderBy/FilterLeftJoin
	// to modify the query.
	Filters []interface{}
	Dialect migrator.Dialect

	params []interface{}
	sql    bytes.Buffer
}

// ToSql builds the SQL query and returns it as a string, together with the SQL parameters.
func (b *Builder) ToSql(limit, page int64) (string, []interface{}) {
	b.params = make([]interface{}, 0)
	b.sql = bytes.Buffer{}

	b.buildSelect()

	b.sql.WriteString("( ")
	orderQuery := b.applyFilters()

	b.sql.WriteString(b.Dialect.LimitOffset(limit, (page-1)*limit) + `) AS ids
		INNER JOIN dashboard ON ids.id = dashboard.id`)
	b.sql.WriteString("\n")

	b.sql.WriteString(
		`LEFT OUTER JOIN dashboard AS folder ON folder.id = dashboard.folder_id
		LEFT OUTER JOIN dashboard_tag ON dashboard.id = dashboard_tag.dashboard_id`)
	b.sql.WriteString("\n")
	b.sql.WriteString(orderQuery)

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
			folder.uid AS folder_uid,
			folder.slug AS folder_slug,
			folder.title AS folder_title
		FROM `)
}

func (b *Builder) applyFilters() (ordering string) {
	joins := []string{}
	orderJoins := []string{}

	wheres := []string{}
	whereParams := []interface{}{}

	groups := []string{}
	groupParams := []interface{}{}

	orders := []string{}

	for _, f := range b.Filters {
		if f, ok := f.(FilterLeftJoin); ok {
			joins = append(joins, fmt.Sprintf(" LEFT OUTER JOIN %s ", f.LeftJoin()))
		}

		if f, ok := f.(FilterWhere); ok {
			sql, params := f.Where()
			if sql != "" {
				wheres = append(wheres, sql)
				whereParams = append(whereParams, params...)
			}
		}

		if f, ok := f.(FilterGroupBy); ok {
			sql, params := f.GroupBy()
			if sql != "" {
				groups = append(groups, sql)
				groupParams = append(groupParams, params...)
			}
		}

		if f, ok := f.(FilterOrderBy); ok {
			if f, ok := f.(FilterLeftJoin); ok {
				orderJoins = append(orderJoins, fmt.Sprintf(" LEFT OUTER JOIN %s ", f.LeftJoin()))
			}
			orders = append(orders, f.OrderBy())
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

	if len(orders) < 1 {
		orders = append(orders, TitleSorter{}.OrderBy())
	}

	orderBy := fmt.Sprintf(" ORDER BY %s", strings.Join(orders, ", "))
	b.sql.WriteString(orderBy)

	order := strings.Join(orderJoins, "")
	order += orderBy
	return order
}
