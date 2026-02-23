package model

import (
	"strings"
	"time"
)

// FilterWhere limits the set of dashboard IDs to the dashboards for
// which the filter is applicable. Results where the first value is
// an empty string are discarded.
type FilterWhere interface {
	Where() (string, []any)
}

// FilterWith returns any recursive CTE queries (if supported)
// and their parameters
type FilterWith interface {
	With() (string, []any)
}

// FilterGroupBy should be used after performing an outer join on the
// search result to ensure there is only one of each ID in the results.
// The id column must be present in the result.
type FilterGroupBy interface {
	GroupBy() (string, []any)
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

type FilterSelect interface {
	Select() string
}

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
