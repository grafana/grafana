package model

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type SortOption struct {
	Name        string
	DisplayName string
	Description string
	Index       int
	MetaName    string
	Filter      []SortOptionFilter
}

type SortOptionFilter interface {
	FilterOrderBy
}

// FilterOrderBy provides an ordering for the search result.
type FilterOrderBy interface {
	OrderBy() string
}

type HitType string

const (
	DashHitDB     HitType = "dash-db"
	DashHitHome   HitType = "dash-home"
	DashHitFolder HitType = "dash-folder"
)

type Hit struct {
	ID                    int64      `json:"id"`
	UID                   string     `json:"uid"`
	OrgID                 int64      `json:"orgId"`
	Title                 string     `json:"title"`
	URI                   string     `json:"uri"`
	URL                   string     `json:"url"`
	Slug                  string     `json:"slug"`
	Type                  HitType    `json:"type"`
	Tags                  []string   `json:"tags"`
	IsStarred             bool       `json:"isStarred"`
	Description           string     `json:"description,omitempty"`
	FolderID              int64      `json:"folderId,omitempty"` // Deprecated: use FolderUID instead
	FolderUID             string     `json:"folderUid,omitempty"`
	FolderTitle           string     `json:"folderTitle,omitempty"`
	FolderURL             string     `json:"folderUrl,omitempty"`
	SortMeta              int64      `json:"sortMeta"`
	SortMetaName          string     `json:"sortMetaName,omitempty"`
	IsDeleted             bool       `json:"isDeleted"`
	PermanentlyDeleteDate *time.Time `json:"permanentlyDeleteDate,omitempty"`
}

type HitList []*Hit

func (s HitList) Len() int      { return len(s) }
func (s HitList) Swap(i, j int) { s[i], s[j] = s[j], s[i] }
func (s HitList) Less(i, j int) bool {
	if s[i].Type == "dash-folder" && s[j].Type == "dash-db" {
		return true
	}

	if s[i].Type == "dash-db" && s[j].Type == "dash-folder" {
		return false
	}

	return strings.ToLower(s[i].Title) < strings.ToLower(s[j].Title)
}

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

type OrgFilter struct {
	OrgId int64
}

type TitleFilter struct {
	Dialect         migrator.Dialect
	Title           string
	TitleExactMatch bool
}

type FolderFilter struct {
	IDs []int64
}

type DashboardFilter struct {
	UIDs []string
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
