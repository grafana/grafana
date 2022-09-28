package querylibrary

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
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
	GetBatch(ctx context.Context, user *user.SignedInUser, uids []string) ([]Query, error)
	Update(ctx context.Context, user *user.SignedInUser, query Query) error
	Delete(ctx context.Context, user *user.SignedInUser, uid string) error
	registry.CanBeDisabled
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) Service {
	s := &service{
		cfg:      cfg,
		log:      log.New("queryLibraryService"),
		features: features,
	}

	if !s.IsDisabled() {
		if err := s.createDBDirectory(); err != nil {
			panic(err)
		}
	}
	return s
}

type service struct {
	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles
	log      log.Logger
}

func (s *service) IsDisabled() bool {
	return !s.features.IsEnabled(featuremgmt.FlagQueryLibrary) || !s.features.IsEnabled(featuremgmt.FlagPanelTitleSearch)
}

func (s *service) Search(ctx context.Context, user *user.SignedInUser, options QuerySearchOptions) ([]QueryInfo, error) {
	queries, err := s.loadQueries(user.OrgID)
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

func asQueryInfo(queries []Query) []QueryInfo {
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

func extractDataSources(query Query) []dslookup.DataSourceRef {
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

func (s *service) GetBatch(ctx context.Context, user *user.SignedInUser, uids []string) ([]Query, error) {
	queries, err := s.loadQueries(user.OrgID)
	if err != nil {
		return nil, err
	}

	uidMap := make(map[string]bool)
	for _, uid := range uids {
		uidMap[uid] = true
	}

	filteredQueries := make([]Query, 0)
	for _, q := range queries {
		if uidMap[q.UID] {
			filteredQueries = append(filteredQueries, q)
		}
	}

	return filteredQueries, nil
}

func (s *service) Update(ctx context.Context, user *user.SignedInUser, query Query) error {
	queries, err := s.loadQueries(user.OrgID)
	if err != nil {
		return err
	}

	titles := make(map[string]bool)
	isNew := true
	filteredQueries := make([]Query, 0)
	for _, q := range queries {
		titles[strings.TrimSpace(strings.ToLower(q.Title))] = true
		if q.UID != query.UID {
			filteredQueries = append(filteredQueries, q)
		} else {
			isNew = false
			filteredQueries = append(filteredQueries, query)
		}
	}

	if isNew {
		if titles[strings.TrimSpace(strings.ToLower(query.Title))] {
			return fmt.Errorf("%s title is already used", query.Title)
		}
		query.UID = util.GenerateShortUID()
		filteredQueries = append(filteredQueries, query)
	}

	return s.writeQueries(user.OrgID, filteredQueries)
}

func (s *service) Delete(ctx context.Context, user *user.SignedInUser, uid string) error {
	queries, err := s.loadQueries(user.OrgID)
	if err != nil {
		return err
	}

	filteredQueries := make([]Query, 0)
	for _, q := range queries {
		if q.UID != uid {
			filteredQueries = append(filteredQueries, q)
		}
	}

	return s.writeQueries(user.OrgID, filteredQueries)
}

func (s *service) queryDBDir() string {
	return filepath.Join(s.cfg.DataPath, "queryLibrary")
}

func (s *service) queryDbPath(orgID int64) string {
	return filepath.Join(s.queryDBDir(), fmt.Sprintf("db-%d.json", orgID))
}

var (
	// increment when changing Queries model
	currentQueryDBVersion = 1
)

type QueryDBFileContents struct {
	Version int     `json:"version"`
	Queries []Query `json:"queries"`
}

func (s *service) loadQueries(orgID int64) ([]Query, error) {
	filePath := s.queryDbPath(orgID)
	// Safe to ignore gosec warning G304.
	// nolint:gosec
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []Query{}, nil
		}
		return nil, fmt.Errorf("can't read %s file: %w", filePath, err)
	}
	var db QueryDBFileContents
	if err = json.Unmarshal(bytes, &db); err != nil {
		return nil, fmt.Errorf("can't unmarshal %s data: %w", filePath, err)
	}

	if db.Version != currentQueryDBVersion {
		if err := s.writeQueries(orgID, []Query{}); err != nil {
			return nil, err
		}

		return []Query{}, nil
	}

	return db.Queries, nil
}

func (s *service) writeQueries(orgID int64, queries []Query) error {
	filePath := s.queryDbPath(orgID)

	bytes, err := json.MarshalIndent(&QueryDBFileContents{
		Version: currentQueryDBVersion,
		Queries: queries,
	}, "", "  ")
	if err != nil {
		return fmt.Errorf("can't marshal query library: %w", err)
	}

	return os.WriteFile(filePath, bytes, 0600)
}

func (s *service) createDBDirectory() error {
	path := s.queryDBDir()

	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		return os.Mkdir(path, 0750)
	}

	return err
}
