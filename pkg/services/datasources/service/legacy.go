package service

import (
	"context"
	"errors"
	"fmt"
	"sync"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// LegacyDataSourceRetriever supports finding a reference to datasources using the name or internal ID
type LegacyDataSourceLookup interface {
	// Find the UID from either the name or internal id
	// NOTE the orgID will be fetched from the context
	GetDataSourceFromDeprecatedFields(ctx context.Context, name string, id int64) (*data.DataSourceRef, error)
}

var (
	_ DataSourceRetriever    = (*Service)(nil)
	_ LegacyDataSourceLookup = (*cachingLegacyDataSourceLookup)(nil)
	_ LegacyDataSourceLookup = (*NoopLegacyDataSourcLookup)(nil)
)

// NoopLegacyDataSourceRetriever does not even try to lookup, it returns a raw reference
type NoopLegacyDataSourcLookup struct {
	Ref *data.DataSourceRef
}

func (s *NoopLegacyDataSourcLookup) GetDataSourceFromDeprecatedFields(ctx context.Context, name string, id int64) (*data.DataSourceRef, error) {
	return s.Ref, nil
}

type cachingLegacyDataSourceLookup struct {
	retriever DataSourceRetriever
	cache     map[string]cachedValue
	cacheMu   sync.Mutex
	log       log.Logger
}

type cachedValue struct {
	ref *data.DataSourceRef
	err error
}

func ProvideLegacyDataSourceLookup(p *Service) LegacyDataSourceLookup {
	return &cachingLegacyDataSourceLookup{
		retriever: p,
		cache:     make(map[string]cachedValue),
		log:       log.New("legacy-datasource-lookup"),
	}
}

func (s *cachingLegacyDataSourceLookup) GetDataSourceFromDeprecatedFields(ctx context.Context, name string, id int64) (*data.DataSourceRef, error) {
	if id == 0 && name == "" {
		s.log.Error("missing id and name in GetDataSourceFromDeprecatedFields")
		return nil, fmt.Errorf("either name or ID must be set")
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		s.log.Error("failed to get user from context after getRequester", "error", err)
		return nil, err
	}
	key := fmt.Sprintf("%d/%s/%d", user.GetOrgID(), name, id)
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()

	v, ok := s.cache[key]
	if ok {
		return v.ref, v.err
	}

	ds, err := s.retriever.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		OrgID: user.GetOrgID(),
		Name:  name,
		ID:    id,
	})
	if err != nil {
		s.log.Error("failed to get datasource from retriever", "error", err)
	}
	if errors.Is(err, datasources.ErrDataSourceNotFound) && name != "" {
		ds, err = s.retriever.GetDataSource(ctx, &datasources.GetDataSourceQuery{
			OrgID: user.GetOrgID(),
			UID:   name, // Sometimes name is actually the UID :(
		})
	}
	v = cachedValue{
		err: err,
	}
	if ds != nil {
		v.ref = &data.DataSourceRef{Type: ds.Type, UID: ds.UID}
	}
	return v.ref, v.err
}
