package models

type SearchResult struct {
	Dashboards []*DashboardSearchHit    `json:"dashboards"`
	Tags       []*DashboardTagCloudItem `json:"tags"`
	TagsOnly   bool                     `json:"tagsOnly"`
}

type DashboardSearchHit struct {
	Id        int64    `json:"id"`
	Title     string   `json:"title"`
	Uri       string   `json:"uri"`
	Type      string   `json:"type"`
	Tags      []string `json:"tags"`
	IsStarred bool     `json:"isStarred"`
}

type DashboardTagCloudItem struct {
	Term  string `json:"term"`
	Count int    `json:"count"`
}

type SearchDashboardsQuery struct {
	Title     string
	Tag       string
	OrgId     int64
	UserId    int64
	Limit     int
	IsStarred bool

	Result []*DashboardSearchHit
}

type GetDashboardTagsQuery struct {
	OrgId  int64
	Result []*DashboardTagCloudItem
}
