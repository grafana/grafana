package models

type SearchResult struct {
	Dashboards []*DashboardSearchHit    `json:"dashboards"`
	Tags       []*DashboardTagCloudItem `json:"tags"`
	TagsOnly   bool                     `json:"tagsOnly"`
}

type DashboardSearchHit struct {
	Id    int64    `json:"id"`
	Title string   `json:"title"`
	Slug  string   `json:"slug"`
	Tags  []string `json:"tags"`
}

type DashboardTagCloudItem struct {
	Term  string `json:"term"`
	Count int    `json:"count"`
}

type SearchDashboardsQuery struct {
	Title     string
	Tag       string
	AccountId int64

	Result []*DashboardSearchHit
}

type GetDashboardTagsQuery struct {
	AccountId int64
	Result    []*DashboardTagCloudItem
}
