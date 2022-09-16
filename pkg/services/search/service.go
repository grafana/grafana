package search

import (
	"context"
	"sort"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/models"
)

func ProvideService(cfg *setting.Cfg, sqlstore *sqlstore.SQLStore, starService star.Service, dashboardService dashboards.DashboardService) *SearchService {
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
	Permission    models.PermissionType
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
	sqlstore         sqlstore.Store
	starService      star.Service
	dashboardService dashboards.DashboardService
}

func (s *SearchService) SearchHandler(ctx context.Context, query *Query) error {
	dashboardQuery := models.FindPersistedDashboardsQuery{
		Title:         query.Title,
		SignedInUser:  query.SignedInUser,
		IsStarred:     query.IsStarred,
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

	if err := s.setStarredDashboards(ctx, query.SignedInUser.UserID, hits); err != nil {
		return err
	}

	query.Result = hits

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

func (s *SearchService) setStarredDashboards(ctx context.Context, userID int64, hits []*models.Hit) error {
	query := star.GetUserStarsQuery{
		UserID: userID,
	}

	res, err := s.starService.GetByUser(ctx, &query)
	if err != nil {
		return err
	}
	iuserstars := res.UserStars
	for _, dashboard := range hits {
		if _, ok := iuserstars[dashboard.ID]; ok {
			dashboard.IsStarred = true
		}
	}

	return nil
}
