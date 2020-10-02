package searchstore

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// FilterWhere limits the set of dashboard IDs to the dashboards for
// which the filter is applicable. Results where the first value is
// an empty string are discarded.
type FilterWhere interface {
	Where() (string, []interface{})
}

// FilterGroupBy should be used after performing an outer join on the
// search result to ensure there is only one of each ID in the results.
// The id column must be present in the result.
type FilterGroupBy interface {
	GroupBy() (string, []interface{})
}

// FilterOrderBy provides an ordering for the search result.
type FilterOrderBy interface {
	OrderBy() string
}

// FilterLeftJoin adds the returned string as a "LEFT OUTER JOIN" to
// allow for fetching extra columns from a table outside of the
// dashboard column.
type FilterLeftJoin interface {
	LeftJoin() string
}

const (
	TypeFolder    = "dash-folder"
	TypeDashboard = "dash-db"
)

type TypeFilter struct {
	Dialect migrator.Dialect
	Type    string
}

func (f TypeFilter) Where() (string, []interface{}) {
	if f.Type == TypeFolder {
		return "dashboard.is_folder = " + f.Dialect.BooleanStr(true), nil
	}

	if f.Type == TypeDashboard {
		return "dashboard.is_folder = " + f.Dialect.BooleanStr(false), nil
	}

	return "", nil
}

type OrgFilter struct {
	OrgId int64
}

func (f OrgFilter) Where() (string, []interface{}) {
	return "dashboard.org_id=?", []interface{}{f.OrgId}
}

type StarredFilter struct {
	UserId int64
}

func (f StarredFilter) Where() (string, []interface{}) {
	return `(SELECT count(*)
			 FROM star
			 WHERE star.dashboard_id = dashboard.id AND star.user_id = ?) > 0`, []interface{}{f.UserId}
}

type TitleFilter struct {
	Dialect migrator.Dialect
	Title   string
}

func (f TitleFilter) Where() (string, []interface{}) {
	return fmt.Sprintf("dashboard.title %s ?", f.Dialect.LikeStr()), []interface{}{"%" + f.Title + "%"}
}

type FolderFilter struct {
	IDs []int64
}

func (f FolderFilter) Where() (string, []interface{}) {
	return sqlIDin("dashboard.folder_id", f.IDs)
}

type DashboardFilter struct {
	IDs []int64
}

func (f DashboardFilter) Where() (string, []interface{}) {
	return sqlIDin("dashboard.id", f.IDs)
}

type TagsFilter struct {
	Tags []string
}

func (f TagsFilter) LeftJoin() string {
	return `dashboard_tag ON dashboard_tag.dashboard_id = dashboard.id`
}

func (f TagsFilter) GroupBy() (string, []interface{}) {
	return `dashboard.id HAVING COUNT(dashboard.id) >= ?`, []interface{}{len(f.Tags)}
}

func (f TagsFilter) Where() (string, []interface{}) {
	params := make([]interface{}, len(f.Tags))
	for i, tag := range f.Tags {
		params[i] = tag
	}
	return `dashboard_tag.term IN (?` + strings.Repeat(",?", len(f.Tags)-1) + `)`, params
}

type TitleSorter struct {
	Descending bool
}

func (s TitleSorter) OrderBy() string {
	if s.Descending {
		return "dashboard.title DESC"
	}

	return "dashboard.title ASC"
}

func sqlIDin(column string, ids []int64) (string, []interface{}) {
	length := len(ids)
	if length < 1 {
		return "", nil
	}

	sqlArray := "(?" + strings.Repeat(",?", length-1) + ")"

	params := []interface{}{}
	for _, id := range ids {
		params = append(params, id)
	}
	return fmt.Sprintf("%s IN %s", column, sqlArray), params
}
