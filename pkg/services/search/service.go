package search

import (
	"context"
	"sort"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlstore db.DB, starService star.Service, dashboardService dashboards.DashboardService) *SearchService {
	s := &SearchService{
		Cfg: cfg,
		sortOptions: map[string]model.SortOption{
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

	Result model.HitList
}

type Service interface {
	SearchHandler(context.Context, *Query) error
	SortOptions() []model.SortOption
}

type SearchService struct {
	Cfg              *setting.Cfg
	sortOptions      map[string]model.SortOption
	sqlstore         db.DB
	starService      star.Service
	dashboardService dashboards.DashboardService
}

func (s *SearchService) SearchHandler(ctx context.Context, query *Query) error {
	dashboardQuery := dashboards.FindPersistedDashboardsQuery{
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

func sortedHits(unsorted model.HitList) model.HitList {
	hits := make(model.HitList, 0)
	hits = append(hits, unsorted...)

	sort.Sort(hits)

	for _, hit := range hits {
		sort.Strings(hit.Tags)
	}

	return hits
}

func (s *SearchService) setStarredDashboards(ctx context.Context, userID int64, hits []*model.Hit) error {
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
