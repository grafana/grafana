package querylibraryimpl

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/x/persistentcollection"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/querylibrary"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) querylibrary.Service {
	return &service{
		cfg:        cfg,
		log:        log.New("queryLibraryService"),
		features:   features,
		collection: persistentcollection.NewLocalFSPersistentCollection[*querylibrary.Query]("query-library", cfg.DataPath, 1),
	}
}

type service struct {
	cfg        *setting.Cfg
	features   featuremgmt.FeatureToggles
	log        log.Logger
	collection persistentcollection.PersistentCollection[*querylibrary.Query]
}

type perRequestQueryLoader struct {
	service querylibrary.Service
	queries map[string]*querylibrary.Query
	ctx     context.Context
	user    *user.SignedInUser
}

func (q *perRequestQueryLoader) byUID(uid string) (*querylibrary.Query, error) {
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

func newPerRequestQueryLoader(ctx context.Context, user *user.SignedInUser, service querylibrary.Service) queryLoader {
	return &perRequestQueryLoader{queries: make(map[string]*querylibrary.Query), ctx: ctx, user: user, service: service}
}

type queryLoader interface {
	byUID(uid string) (*querylibrary.Query, error)
}

func (s *service) UpdateDashboardQueries(ctx context.Context, user *user.SignedInUser, dash *dashboards.Dashboard) error {
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

func (s *service) Search(ctx context.Context, user *user.SignedInUser, options querylibrary.QuerySearchOptions) ([]querylibrary.QueryInfo, error) {
	queries, err := s.collection.Find(ctx, namespaceFromUser(user), func(_ *querylibrary.Query) (bool, error) { return true, nil })
	if err != nil {
		return nil, err
	}

	queryInfo := asQueryInfo(queries)
	filteredQueryInfo := make([]querylibrary.QueryInfo, 0)
	for _, q := range queryInfo {
		if len(options.Query) > 0 {
			lowerTitle := strings.ReplaceAll(strings.ToLower(q.Title), " ", "")
			lowerQuery := strings.ReplaceAll(strings.ToLower(options.Query), " ", "")

			if !strings.Contains(lowerTitle, lowerQuery) {
				continue
			}
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

func asQueryInfo(queries []*querylibrary.Query) []querylibrary.QueryInfo {
	res := make([]querylibrary.QueryInfo, 0)
	for _, query := range queries {
		res = append(res, querylibrary.QueryInfo{
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

func isQueryWithMixedDataSource(q *querylibrary.Query) (isMixed bool, firstDsRef dashboard.DataSourceRef) {
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

func extractDataSources(query *querylibrary.Query) []dashboard.DataSourceRef {
	ds := make([]dashboard.DataSourceRef, 0)

	for _, q := range query.Queries {
		dsUid := getDatasourceUID(q)
		dsType := q.Get("datasource").Get("type").MustString()
		if expr.IsDataSource(dsUid) {
			dsType = expr.DatasourceType
		}

		ds = append(ds, dashboard.DataSourceRef{
			UID:  dsUid,
			Type: dsType,
		})
	}

	return ds
}

func (s *service) GetBatch(ctx context.Context, user *user.SignedInUser, uids []string) ([]*querylibrary.Query, error) {
	uidMap := make(map[string]bool)
	for _, uid := range uids {
		uidMap[uid] = true
	}

	return s.collection.Find(ctx, namespaceFromUser(user), func(q *querylibrary.Query) (bool, error) {
		if _, ok := uidMap[q.UID]; ok {
			return true, nil
		}

		return false, nil
	})
}

func (s *service) Update(ctx context.Context, user *user.SignedInUser, query *querylibrary.Query) error {
	if query.UID == "" {
		queriesWithTheSameTitle, err := s.Search(ctx, user, querylibrary.QuerySearchOptions{Query: query.Title})
		if err != nil {
			return err
		}

		if len(queriesWithTheSameTitle) != 0 {
			return fmt.Errorf("can't create query with title '%s'. existing query with similar name: '%s'", query.Title, queriesWithTheSameTitle[0].Title)
		}

		query.UID = util.GenerateShortUID()
		return s.collection.Insert(ctx, namespaceFromUser(user), query)
	}

	_, err := s.collection.Update(ctx, namespaceFromUser(user), func(q *querylibrary.Query) (updated bool, updatedItem *querylibrary.Query, err error) {
		if q.UID == query.UID {
			return true, query, nil
		}

		return false, nil, nil
	})
	return err
}

func (s *service) Delete(ctx context.Context, user *user.SignedInUser, uid string) error {
	_, err := s.collection.Delete(ctx, namespaceFromUser(user), func(q *querylibrary.Query) (bool, error) {
		if q.UID == uid {
			return true, nil
		}

		return false, nil
	})

	return err
}
