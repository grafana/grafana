package search

import "strings"
import "github.com/grafana/grafana/pkg/models"

type HitType string

const (
	DashHitDB     HitType = "dash-db"
	DashHitHome   HitType = "dash-home"
	DashHitFolder HitType = "dash-folder"
)

type Hit struct {
	Id          int64    `json:"id"`
	Uid         string   `json:"uid"`
	Title       string   `json:"title"`
	Uri         string   `json:"uri"`
	Url         string   `json:"url"`
	Type        HitType  `json:"type"`
	Tags        []string `json:"tags"`
	IsStarred   bool     `json:"isStarred"`
	FolderId    int64    `json:"folderId,omitempty"`
	FolderUid   string   `json:"folderUid,omitempty"`
	FolderTitle string   `json:"folderTitle,omitempty"`
	FolderUrl   string   `json:"folderUrl,omitempty"`
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

type Query struct {
	Title        string
	Tags         []string
	OrgId        int64
	SignedInUser *models.SignedInUser
	Limit        int
	IsStarred    bool
	Type         string
	DashboardIds []int64
	FolderIds    []int64
	Permission   models.PermissionType

	Result HitList
}

type FindPersistedDashboardsQuery struct {
	Title        string
	OrgId        int64
	SignedInUser *models.SignedInUser
	IsStarred    bool
	DashboardIds []int64
	Type         string
	FolderIds    []int64
	Tags         []string
	Limit        int
	Permission   models.PermissionType

	Result HitList
}
