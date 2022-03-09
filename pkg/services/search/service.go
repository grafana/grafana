package search

import (
	"context"
	"sort"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func ProvideService(cfg *setting.Cfg, bus bus.Bus, sqlstore *sqlstore.SQLStore, starManager star.Manager) *SearchService {
	s := &SearchService{
		Cfg: cfg,
		Bus: bus,
		sortOptions: map[string]models.SortOption{
			SortAlphaAsc.Name:  SortAlphaAsc,
			SortAlphaDesc.Name: SortAlphaDesc,
		},
		sqlstore:    sqlstore,
		starManager: starManager,
	}
	s.Bus.AddHandler(s.SearchHandler)
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

	Result models.HitList
}

type Service interface {
	SearchHandler(context.Context, *Query) error
	SortOptions() []models.SortOption
}

type SearchService struct {
	Bus         bus.Bus
	Cfg         *setting.Cfg
	sortOptions map[string]models.SortOption
	sqlstore    sqlstore.Store
	starManager star.Manager
}

func (s *SearchService) SearchHandler(ctx context.Context, query *Query) error {
	dashboardQuery := models.FindPersistedDashboardsQuery{
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

	if err := s.sqlstore.SearchDashboards(ctx, &dashboardQuery); err != nil {
		return err
	}

	hits := dashboardQuery.Result
	if query.Sort == "" {
		hits = sortedHits(hits)
	}

	if err := s.setStarredDashboards(ctx, query.SignedInUser.UserId, hits); err != nil {
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
	query := models.GetUserStarsQuery{
		UserId: userID,
	}

	iuserstars, err := s.starManager.GetUserStars(ctx, &query)
	if err != nil {
		return err
	}

	for _, dashboard := range hits {
		if _, ok := iuserstars[dashboard.ID]; ok {
			dashboard.IsStarred = true
		}
	}

	return nil
}
