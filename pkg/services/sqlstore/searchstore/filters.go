package searchstore

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	TypeFolder      = "dash-folder"
	TypeDashboard   = "dash-db"
	TypeAlertFolder = "dash-folder-alerting"
	TypeAnnotation  = "dash-annotation"
)

type TypeFilter struct {
	Dialect migrator.Dialect
	Type    string
}

func (f TypeFilter) Where() (string, []any) {
	if f.Type == TypeFolder || f.Type == TypeAlertFolder {
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

func (f OrgFilter) Where() (string, []any) {
	return "dashboard.org_id=?", []any{f.OrgId}
}

type TitleFilter struct {
	Dialect migrator.Dialect
	Title   string
}

func (f TitleFilter) Where() (string, []any) {
	sql, params := f.Dialect.LikeOperator("dashboard.title", true, f.Title, true)
	return sql, []any{params}
}

type FolderFilter struct {
	IDs []int64
}

func (f FolderFilter) Where() (string, []any) {
	return sqlIDin("dashboard.folder_id", f.IDs)
}

type FolderUIDFilter struct {
	Dialect              migrator.Dialect
	OrgID                int64
	UIDs                 []string
	NestedFoldersEnabled bool
}

func (f FolderUIDFilter) Where() (string, []any) {
	if len(f.UIDs) < 1 {
		return "", nil
	}

	params := []any{}
	includeGeneral := false
	for _, uid := range f.UIDs {
		if uid == folder.GeneralFolderUID {
			includeGeneral = true
			continue
		}
		params = append(params, uid)
	}

	q := ""
	switch {
	case len(params) < 1:
		// do nothing
	case len(params) == 1:
		q = "dashboard.folder_id IN (SELECT id FROM dashboard WHERE org_id = ? AND uid = ?)"
		if f.NestedFoldersEnabled {
			q = "dashboard.org_id = ? AND dashboard.folder_uid = ?"
		}
		params = append([]any{f.OrgID}, params...)
	default:
		sqlArray := "(?" + strings.Repeat(",?", len(params)-1) + ")"
		q = "dashboard.folder_id IN (SELECT id FROM dashboard WHERE org_id = ? AND uid IN " + sqlArray + ")"
		if f.NestedFoldersEnabled {
			q = "dashboard.org_id = ? AND dashboard.folder_uid IN " + sqlArray
		}
		params = append([]any{f.OrgID}, params...)
	}

	if includeGeneral {
		if q == "" {
			if f.NestedFoldersEnabled {
				q = "dashboard.folder_uid IS NULL "
			} else {
				q = "dashboard.folder_id = ? "
				params = append(params, 0)
			}
		} else {
			if f.NestedFoldersEnabled {
				q = "(" + q + " OR dashboard.folder_uid IS NULL)"
			} else {
				q = "(" + q + " OR dashboard.folder_id = ?)"
				params = append(params, 0)
			}
		}
	}

	return q, params
}

type DashboardIDFilter struct {
	IDs []int64
}

func (f DashboardIDFilter) Where() (string, []any) {
	return sqlIDin("dashboard.id", f.IDs)
}

type DashboardFilter struct {
	UIDs []string
}

func (f DashboardFilter) Where() (string, []any) {
	return sqlUIDin("dashboard.uid", f.UIDs)
}

type K6FolderFilter struct{}

func (f K6FolderFilter) Where() (string, []any) {
	filter := "dashboard.uid != ? AND (dashboard.folder_uid != ? OR dashboard.folder_uid IS NULL)"
	params := []any{accesscontrol.K6FolderUID, accesscontrol.K6FolderUID}
	return filter, params
}

type TagsFilter struct {
	Tags []string
}

func (f TagsFilter) LeftJoin() string {
	return `dashboard_tag ON dashboard_tag.dashboard_id = dashboard.id`
}

func (f TagsFilter) GroupBy() (string, []any) {
	return `dashboard.id HAVING COUNT(dashboard.id) >= ?`, []any{len(f.Tags)}
}

func (f TagsFilter) Where() (string, []any) {
	params := make([]any, len(f.Tags))
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

func sqlIDin(column string, ids []int64) (string, []any) {
	length := len(ids)
	if length < 1 {
		return "", nil
	}

	sqlArray := "(?" + strings.Repeat(",?", length-1) + ")"

	params := []any{}
	for _, id := range ids {
		params = append(params, id)
	}
	return fmt.Sprintf("%s IN %s", column, sqlArray), params
}

func sqlUIDin(column string, uids []string) (string, []any) {
	length := len(uids)
	if length < 1 {
		return "", nil
	}

	sqlArray := "(?" + strings.Repeat(",?", length-1) + ")"

	params := []any{}
	for _, id := range uids {
		params = append(params, id)
	}
	return fmt.Sprintf("%s IN %s", column, sqlArray), params
}

// FolderWithAlertsFilter applies a filter that makes the result contain only folders that contain alert rules
type FolderWithAlertsFilter struct {
}

var _ model.FilterWhere = &FolderWithAlertsFilter{}

func (f FolderWithAlertsFilter) Where() (string, []any) {
	return "EXISTS (SELECT 1 FROM alert_rule WHERE alert_rule.namespace_uid = dashboard.uid)", nil
}

type DeletedFilter struct {
	Deleted bool
}

func (f DeletedFilter) Where() (string, []any) {
	if f.Deleted {
		return "dashboard.deleted IS NOT NULL", nil
	}

	return "dashboard.deleted IS NULL", nil
}
