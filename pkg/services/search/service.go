package search

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/setting"
	"sort"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
)

func init() {
	registry.RegisterService(&SearchService{})
}

type Query struct {
	Title        string
	Tags         []string
	OrgId        int64
	SignedInUser *models.SignedInUser
	Limit        int64
	Page         int64
	IsStarred    bool
	Type         string
	DashboardIds []int64
	FolderIds    []int64
	Permission   models.PermissionType
	Sort         string

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
	Limit        int64
	Page         int64
	Permission   models.PermissionType

	FeatureSearch2 bool
	SortBy         searchstore.FilterOrderBy

	Result HitList
}

type SearchService struct {
	Bus bus.Bus      `inject:""`
	Cfg *setting.Cfg `inject:""`
}

func (s *SearchService) Init() error {
	s.Bus.AddHandler(s.searchHandler)
	return nil
}

func (s *SearchService) searchHandler(query *Query) error {
	sortOpt, exists := sortOptions[query.Sort]
	if !exists {
		sortOpt = sortAlphaAsc
	}

	search2 := false
	if s.Cfg != nil {
		search2 = s.Cfg.FeatureToggles["search2"]
	}

	dashboardQuery := FindPersistedDashboardsQuery{
		Title:          query.Title,
		SignedInUser:   query.SignedInUser,
		IsStarred:      query.IsStarred,
		DashboardIds:   query.DashboardIds,
		Type:           query.Type,
		FolderIds:      query.FolderIds,
		Tags:           query.Tags,
		Limit:          query.Limit,
		Page:           query.Page,
		Permission:     query.Permission,
		FeatureSearch2: search2,
		SortBy:         sortOpt.Filter,
	}

	if err := bus.Dispatch(&dashboardQuery); err != nil {
		return err
	}

	hits := dashboardQuery.Result
	if query.Sort == "" {
		hits = sortedHits(hits)
	}

	if err := setStarredDashboards(query.SignedInUser.UserId, hits); err != nil {
		return err
	}

	query.Result = hits

	return nil
}

func sortedHits(unsorted HitList) HitList {
	hits := make(HitList, 0)
	hits = append(hits, unsorted...)

	sort.Sort(hits)

	for _, hit := range hits {
		sort.Strings(hit.Tags)
	}

	return hits
}

func setStarredDashboards(userID int64, hits []*Hit) error {
	query := models.GetUserStarsQuery{
		UserId: userID,
	}

	if err := bus.Dispatch(&query); err != nil {
		return err
	}

	for _, dashboard := range hits {
		if _, ok := query.Result[dashboard.Id]; ok {
			dashboard.IsStarred = true
		}
	}

	return nil
}
