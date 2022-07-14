package eval

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// LastSeenDatasourceCache is a datasource cache, which on error, returns the last seen
// version of the datasource.
type LastSeenDatasourceCache struct {
	cache       datasources.CacheService
	log         log.Logger
	datasources map[int64]*datasources.DataSource
	uidsToIDs   map[string]int64
	mu          sync.RWMutex
}

func NewLastSeenDatasourceCache(cache datasources.CacheService, log log.Logger) *LastSeenDatasourceCache {
	return &LastSeenDatasourceCache{
		cache:       cache,
		log:         log,
		datasources: make(map[int64]*datasources.DataSource),
		uidsToIDs:   make(map[string]int64),
	}
}

// GetDatasource returns the datasource with the ID. If there is an error on cache miss
// then it returns the last seen version of the datasource.
func (s *LastSeenDatasourceCache) GetDatasource(ctx context.Context, datasourceID int64, user *models.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
	datasource, err := s.cache.GetDatasource(ctx, datasourceID, user, skipCache)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return nil, err
		}
		if datasource = s.getLastSeenDatasource(ctx, datasourceID, user); datasource != nil {
			s.log.Info("failed to get datasource, using last seen datasource instead",
				"datasourceID", datasourceID, "err", err)
			return datasource, nil
		}
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.datasources[datasource.Id] = datasource
	return datasource, nil
}

func (s *LastSeenDatasourceCache) getLastSeenDatasource(_ context.Context, datasourceID int64, user *models.SignedInUser) *datasources.DataSource {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if v, ok := s.datasources[datasourceID]; ok {
		// We still need to check that the signed in user has permission
		// to use this datasource
		if v.OrgId == user.OrgId {
			return v
		}
	}
	return nil
}

// GetDatasourceByUID returns the datasource with the UID. If there is an error on cache miss
// then it returns the last seen version of the datasource.
func (s *LastSeenDatasourceCache) GetDatasourceByUID(ctx context.Context, datasourceUID string, user *models.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
	datasource, err := s.cache.GetDatasourceByUID(ctx, datasourceUID, user, skipCache)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return nil, err
		}
		if datasource = s.getLastSeenDatasourceByUID(ctx, datasourceUID, user); datasource != nil {
			s.log.Info("failed to get datasource, using last seen datasource instead",
				"datasourceUID", datasourceUID, "err", err)
			return datasource, nil
		}
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.uidsToIDs[datasource.Uid] = datasource.Id
	s.datasources[datasource.Id] = datasource
	return datasource, nil
}

func (s *LastSeenDatasourceCache) getLastSeenDatasourceByUID(_ context.Context, datasourceUID string, user *models.SignedInUser) *datasources.DataSource {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if datasourceID, ok := s.uidsToIDs[datasourceUID]; ok {
		if v, ok := s.datasources[datasourceID]; ok {
			// We still need to check that the signed in user has permission
			// to use this datasource
			if v.OrgId == user.OrgId {
				return v
			}
		}
	}
	return nil
}
