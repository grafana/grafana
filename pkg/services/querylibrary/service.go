package querylibrary

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/x/persistentcollection"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type QuerySearchOptions struct {
	DatasourceUID  string
	Query          string
	DatasourceType string
}

type Service interface {
	Search(ctx context.Context, user *user.SignedInUser, options QuerySearchOptions) ([]QueryInfo, error)
	GetBatch(ctx context.Context, user *user.SignedInUser, uids []string) ([]*Query, error)
	Update(ctx context.Context, user *user.SignedInUser, query *Query) error
	Delete(ctx context.Context, user *user.SignedInUser, uid string) error
	UpdateDashboardQueries(ctx context.Context, user *user.SignedInUser, dash *models.Dashboard) error
	registry.CanBeDisabled
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) Service {
	return &service{
		cfg:        cfg,
		log:        log.New("queryLibraryService"),
		features:   features,
		collection: persistentcollection.NewLocalFSPersistentCollection[*Query]("query-library", cfg.DataPath, 1),
	}
}

type service struct {
	cfg        *setting.Cfg
	features   featuremgmt.FeatureToggles
	log        log.Logger
	collection persistentcollection.PersistentCollection[*Query]
}

type perRequestQueryLoader struct {
	service Service
	queries map[string]*Query
	ctx     context.Context
	user    *user.SignedInUser
}

func (q *perRequestQueryLoader) byUID(uid string) (*Query, error) {
	if q, ok := q.queries[uid]; ok {
		return q, nil
	}

	queries, err := q.service.GetBatch(q.ctx, q.user, []string{uid})
	if err != nil {
		return nil, err
	}

	if len(queries) != 1 {
		return nil, err
	}

	q.queries[uid] = queries[0]
	return queries[0], nil
}

func newPerRequestQueryLoader(ctx context.Context, user *user.SignedInUser, service Service) queryLoader {
	return &perRequestQueryLoader{queries: make(map[string]*Query), ctx: ctx, user: user, service: service}
}

type queryLoader interface {
	byUID(uid string) (*Query, error)
}

func (s *service) UpdateDashboardQueries(ctx context.Context, user *user.SignedInUser, dash *models.Dashboard) error {
	queryLoader := newPerRequestQueryLoader(ctx, user, s)
	return s.updateQueriesRecursively(queryLoader, dash.Data)
}

func (s *service) updateQueriesRecursively(loader queryLoader, parent *simplejson.Json) error {
	panels := parent.Get("panels").MustArray()
	for i := range panels {
		panelAsJSON := simplejson.NewFromAny(panels[i])
		panelType := panelAsJSON.Get("type").MustString()

		if panelType == "row" {
			err := s.updateQueriesRecursively(loader, panelAsJSON)
			if err != nil {
				return err
			}
			continue
		}

		queryUID := panelAsJSON.GetPath("savedQueryLink", "ref", "uid").MustString()
		if queryUID == "" {
			continue
		}

		query, err := loader.byUID(queryUID)
		if err != nil {
			return err
		}

		if query == nil {
			// query deleted - unlink
			panelAsJSON.Set("savedQueryLink", nil)
			continue
		}

		queriesAsMap := make([]interface{}, 0)
		for idx := range query.Queries {
			queriesAsMap = append(queriesAsMap, query.Queries[idx].MustMap())
		}
		panelAsJSON.Set("targets", queriesAsMap)

		isMixed, firstDsRef := isQueryWithMixedDataSource(query)
		if isMixed {
			panelAsJSON.Set("datasource", map[string]interface{}{
				"uid":  "-- Mixed --",
				"type": "datasource",
			})
		} else {
			panelAsJSON.Set("datasource", map[string]interface{}{
				"uid":  firstDsRef.UID,
				"type": firstDsRef.Type,
			})
		}
	}

	return nil
}

func (s *service) IsDisabled() bool {
	return !s.features.IsEnabled(featuremgmt.FlagQueryLibrary) || !s.features.IsEnabled(featuremgmt.FlagPanelTitleSearch)
}

func namespaceFromUser(user *user.SignedInUser) string {
	return fmt.Sprintf("orgId-%d", user.OrgID)
}

func (s *service) Search(ctx context.Context, user *user.SignedInUser, options QuerySearchOptions) ([]QueryInfo, error) {
	queries, err := s.collection.Find(ctx, namespaceFromUser(user), func(_ *Query) (bool, error) { return true, nil })
	if err != nil {
		return nil, err
	}

	queryInfo := asQueryInfo(queries)
	filteredQueryInfo := make([]QueryInfo, 0)
	for _, q := range queryInfo {
		if len(options.Query) > 0 && !strings.Contains(strings.TrimSpace(strings.ToLower(q.Title)), options.Query) {
			continue
		}

		if len(options.DatasourceUID) > 0 || len(options.DatasourceType) > 0 {
			dsUids := make(map[string]bool)
			dsTypes := make(map[string]bool)
			for _, ds := range q.Datasource {
				dsUids[ds.UID] = true
				dsTypes[ds.Type] = true
			}

			if len(options.DatasourceType) > 0 && !dsTypes[options.DatasourceType] {
				continue
			}

			if len(options.DatasourceUID) > 0 && !dsUids[options.DatasourceUID] {
				continue
			}
		}

		filteredQueryInfo = append(filteredQueryInfo, q)
	}

	return filteredQueryInfo, nil
}

func asQueryInfo(queries []*Query) []QueryInfo {
	res := make([]QueryInfo, 0)
	for _, query := range queries {
		res = append(res, QueryInfo{
			UID:           query.UID,
			Title:         query.Title,
			Description:   query.Description,
			Tags:          query.Tags,
			TimeFrom:      query.Time.From,
			TimeTo:        query.Time.To,
			SchemaVersion: query.SchemaVersion,
			Datasource:    extractDataSources(query),
		})
	}
	return res
}

func getDatasourceUID(q *simplejson.Json) string {
	uid := q.Get("datasource").Get("uid").MustString()

	if uid == "" {
		uid = q.Get("datasource").MustString()
	}

	if expr.IsDataSource(uid) {
		return expr.DatasourceUID
	}

	return uid
}

func isQueryWithMixedDataSource(q *Query) (isMixed bool, firstDsRef dslookup.DataSourceRef) {
	dsRefs := extractDataSources(q)

	for _, dsRef := range dsRefs {
		if dsRef.Type == expr.DatasourceType {
			continue
		}

		if firstDsRef.UID == "" {
			firstDsRef = dsRef
			continue
		}

		if firstDsRef.UID != dsRef.UID || firstDsRef.Type != dsRef.Type {
			return true, firstDsRef
		}
	}

	return false, firstDsRef
}

func extractDataSources(query *Query) []dslookup.DataSourceRef {
	ds := make([]dslookup.DataSourceRef, 0)

	for _, q := range query.Queries {
		dsUid := getDatasourceUID(q)
		dsType := q.Get("datasource").Get("type").MustString()
		if expr.IsDataSource(dsUid) {
			dsType = expr.DatasourceType
		}

		ds = append(ds, dslookup.DataSourceRef{
			UID:  dsUid,
			Type: dsType,
		})
	}

	return ds
}

func (s *service) GetBatch(ctx context.Context, user *user.SignedInUser, uids []string) ([]*Query, error) {
	uidMap := make(map[string]bool)
	for _, uid := range uids {
		uidMap[uid] = true
	}

	return s.collection.Find(ctx, namespaceFromUser(user), func(q *Query) (bool, error) {
		if _, ok := uidMap[q.UID]; ok {
			return true, nil
		}

		return false, nil
	})
}

func (s *service) Update(ctx context.Context, user *user.SignedInUser, query *Query) error {
	if query.UID == "" {
		query.UID = util.GenerateShortUID()

		return s.collection.Insert(ctx, namespaceFromUser(user), query)
	}

	_, err := s.collection.Update(ctx, namespaceFromUser(user), func(q *Query) (updated bool, updatedItem *Query, err error) {
		if q.UID == query.UID {
			return true, query, nil
		}

		return false, nil, nil
	})
	return err
}

func (s *service) Delete(ctx context.Context, user *user.SignedInUser, uid string) error {
	_, err := s.collection.Delete(ctx, namespaceFromUser(user), func(q *Query) (bool, error) {
		if q.UID == uid {
			return true, nil
		}

		return false, nil
	})

	return err
}
