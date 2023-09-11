package search

import (
	"context"
	"sort"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlstore db.DB, starService star.Service, dashboardService dashboards.DashboardService) *SearchService {
	s := &SearchService{
		Cfg: cfg,
		sortOptions: map[string]models.SortOption{
			SortAlphaAsc.Name:  SortAlphaAsc,
			SortAlphaDesc.Name: SortAlphaDesc,
		},
		sqlstore:         sqlstore,
		starService:      starService,
		dashboardService: dashboardService,
	}
	return s
}

type Query struct {
	Title         string
	Tags          []string
	OrgId         int64
	SignedInUser  *user.SignedInUser
	Limit         int64
	Page          int64
	IsStarred     bool
	Type          string
	DashboardUIDs []string
	DashboardIds  []int64
	FolderIds     []int64
	Permission    dashboards.PermissionType
	Sort          string

	Result models.HitList
}

type Service interface {
	SearchHandler(context.Context, *Query) error
	SortOptions() []models.SortOption
}

type SearchService struct {
	Cfg              *setting.Cfg
	sortOptions      map[string]models.SortOption
	sqlstore         db.DB
	starService      star.Service
	dashboardService dashboards.DashboardService
}

func (s *SearchService) SearchHandler(ctx context.Context, query *Query) error {
	starredQuery := star.GetUserStarsQuery{
		UserID: query.SignedInUser.UserID,
	}
	staredDashIDs, err := s.starService.GetByUser(ctx, &starredQuery)
	if err != nil {
		return err
	}

	// No starred dashboards will be found
	if query.IsStarred && len(staredDashIDs.UserStars) == 0 {
		query.Result = models.HitList{}
		return nil
	}

	// filter by starred dashboard IDs when starred dashboards are requested and no UID or ID filters are specified to improve query performance
	if query.IsStarred && len(query.DashboardIds) == 0 && len(query.DashboardUIDs) == 0 {
		for id := range staredDashIDs.UserStars {
			query.DashboardIds = append(query.DashboardIds, id)
		}
	}

	dashboardQuery := dashboards.FindPersistedDashboardsQuery{
		Title:         query.Title,
		SignedInUser:  query.SignedInUser,
		DashboardUIDs: query.DashboardUIDs,
		DashboardIds:  query.DashboardIds,
		Type:          query.Type,
		FolderIds:     query.FolderIds,
		Tags:          query.Tags,
		Limit:         query.Limit,
		Page:          query.Page,
		Permission:    query.Permission,
	}

	if sortOpt, exists := s.sortOptions[query.Sort]; exists {
		dashboardQuery.Sort = sortOpt
	}

	if err := s.dashboardService.SearchDashboards(ctx, &dashboardQuery); err != nil {
		return err
	}

	hits := dashboardQuery.Result
	if query.Sort == "" {
		hits = sortedHits(hits)
	}

	// set starred dashboards
	for _, dashboard := range hits {
		if _, ok := staredDashIDs.UserStars[dashboard.ID]; ok {
			dashboard.IsStarred = true
		}
	}

	// filter for starred dashboards if requested
	if !query.IsStarred {
		query.Result = hits
	} else {
		query.Result = models.HitList{}
		for _, dashboard := range hits {
			if dashboard.IsStarred {
				query.Result = append(query.Result, dashboard)
			}
		}
	}

	return nil
}

func sortedHits(unsorted models.HitList) models.HitList {
	hits := make(models.HitList, 0)
	hits = append(hits, unsorted...)

	sort.Sort(hits)

	for _, hit := range hits {
		sort.Strings(hit.Tags)
	}

	return hits
}
