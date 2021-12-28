package search

import (
	"context"
	"sort"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func ProvideService(cfg *setting.Cfg, bus bus.Bus) *SearchService {
	s := &SearchService{
		Cfg: cfg,
		Bus: bus,
		sortOptions: map[string]SortOption{
			SortAlphaAsc.Name:  SortAlphaAsc,
			SortAlphaDesc.Name: SortAlphaDesc,
		},
	}
	s.Bus.AddHandlerCtx(s.searchHandler)
	return s
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
	Sort         SortOption

	Filters []interface{}

	Result HitList
}

type SearchService struct {
	Bus bus.Bus
	Cfg *setting.Cfg

	sortOptions map[string]SortOption
}

func (s *SearchService) searchHandler(ctx context.Context, query *Query) error {
	dashboardQuery := FindPersistedDashboardsQuery{
		Title:        query.Title,
		SignedInUser: query.SignedInUser,
		IsStarred:    query.IsStarred,
		DashboardIds: query.DashboardIds,
		Type:         query.Type,
		FolderIds:    query.FolderIds,
		Tags:         query.Tags,
		Limit:        query.Limit,
		Page:         query.Page,
		Permission:   query.Permission,
	}

	if sortOpt, exists := s.sortOptions[query.Sort]; exists {
		dashboardQuery.Sort = sortOpt
	}

	if err := bus.DispatchCtx(ctx, &dashboardQuery); err != nil {
		return err
	}

	hits := dashboardQuery.Result
	if query.Sort == "" {
		hits = sortedHits(hits)
	}

	if err := setStarredDashboards(ctx, query.SignedInUser.UserId, hits); err != nil {
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

func setStarredDashboards(ctx context.Context, userID int64, hits []*Hit) error {
	query := models.GetUserStarsQuery{
		UserId: userID,
	}

	if err := bus.DispatchCtx(ctx, &query); err != nil {
		return err
	}

	for _, dashboard := range hits {
		if _, ok := query.Result[dashboard.ID]; ok {
			dashboard.IsStarred = true
		}
	}

	return nil
}
