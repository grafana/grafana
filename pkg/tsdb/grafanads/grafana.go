package grafanads

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
)

// DatasourceName is the string constant used as the datasource name in requests
// to identify it as a Grafana DS command.
const DatasourceName = "-- Grafana --"

// DatasourceID is the fake datasource id used in requests to identify it as a
// Grafana DS command.
const DatasourceID = -1

// DatasourceUID is the fake datasource uid used in requests to identify it as a
// Grafana DS command.
const DatasourceUID = "grafana"

const pluginID = "grafana"

// Make sure Service implements required interfaces.
// This is important to do since otherwise we will only get a
// not implemented error response from plugin at runtime.
var (
	_      backend.QueryDataHandler   = (*Service)(nil)
	_      backend.CheckHealthHandler = (*Service)(nil)
	logger                            = log.New("tsdb.grafana")
)

func ProvideService(cfg *setting.Cfg, registrar plugins.Store) *Service {
	return newService(cfg, registrar)
}

func newService(cfg *setting.Cfg, pluginStore plugins.Store) *Service {
	s := &Service{
		staticRootPath: cfg.StaticRootPath,
		roots: []string{
			"testdata",
			"img/icons",
			"img/bg",
			"gazetteer",
			"upload", // does not exist yet
		},
	}

	resolver := plugins.CoreBackendPluginPathResolver(cfg, pluginID)
	if err := pluginStore.AddWithFactory(context.Background(), pluginID, coreplugin.New(backend.ServeOpts{
		CheckHealthHandler: s,
		QueryDataHandler:   s,
	}), resolver); err != nil {
		logger.Error("Failed to register plugin", "error", err)
		return nil
	}
	return s
}

// Service exists regardless of user settings
type Service struct {
	// path to the public folder
	staticRootPath string
	roots          []string
}

func DataSourceModel(orgId int64) *models.DataSource {
	return &models.DataSource{
		Id:             DatasourceID,
		Uid:            DatasourceUID,
		Name:           DatasourceName,
		Type:           "grafana",
		OrgId:          orgId,
		JsonData:       simplejson.New(),
		SecureJsonData: make(map[string][]byte),
	}
}

func (s *Service) QueryData(_ context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		switch q.QueryType {
		case queryTypeRandomWalk:
			response.Responses[q.RefID] = s.doRandomWalk(q)
		case queryTypeList:
			response.Responses[q.RefID] = s.doListQuery(q)
		case queryTypeRead:
			response.Responses[q.RefID] = s.doReadQuery(q)
		default:
			response.Responses[q.RefID] = backend.DataResponse{
				Error: fmt.Errorf("unknown query type"),
			}
		}
	}

	return response, nil
}

func (s *Service) CheckHealth(_ context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "OK",
	}, nil
}

func (s *Service) publicPath(path string) (string, error) {
	if strings.Contains(path, "..") {
		return "", fmt.Errorf("invalid string")
	}

	ok := false
	for _, root := range s.roots {
		if strings.HasPrefix(path, root) {
			ok = true
			break
		}
	}
	if !ok {
		return "", fmt.Errorf("bad root path")
	}
	return filepath.Join(s.staticRootPath, path), nil
}

func (s *Service) doListQuery(query backend.DataQuery) backend.DataResponse {
	q := &listQueryModel{}
	response := backend.DataResponse{}
	err := json.Unmarshal(query.JSON, &q)
	if err != nil {
		response.Error = err
		return response
	}

	if q.Path == "" {
		count := len(s.roots)
		names := data.NewFieldFromFieldType(data.FieldTypeString, count)
		mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
		names.Name = "name"
		mtype.Name = "mediaType"
		for i, f := range s.roots {
			names.Set(i, f)
			mtype.Set(i, "directory")
		}
		frame := data.NewFrame("", names, mtype)
		frame.SetMeta(&data.FrameMeta{
			Type: data.FrameTypeDirectoryListing,
		})
		response.Frames = data.Frames{frame}
	} else {
		path, err := s.publicPath(q.Path)
		if err != nil {
			response.Error = err
			return response
		}
		frame, err := experimental.GetDirectoryFrame(path, false)
		if err != nil {
			response.Error = err
			return response
		}
		response.Frames = data.Frames{frame}
	}

	return response
}

func (s *Service) doReadQuery(query backend.DataQuery) backend.DataResponse {
	q := &listQueryModel{}
	response := backend.DataResponse{}
	err := json.Unmarshal(query.JSON, &q)
	if err != nil {
		response.Error = err
		return response
	}

	if filepath.Ext(q.Path) != ".csv" {
		response.Error = fmt.Errorf("unsupported file type")
		return response
	}

	path, err := s.publicPath(q.Path)
	if err != nil {
		response.Error = err
		return response
	}

	// Can ignore gosec G304 here, because we check the file pattern above
	// nolint:gosec
	fileReader, err := os.Open(path)
	if err != nil {
		response.Error = fmt.Errorf("failed to read file")
		return response
	}

	defer func() {
		if err := fileReader.Close(); err != nil {
			logger.Warn("Failed to close file", "err", err, "path", path)
		}
	}()

	frame, err := testdatasource.LoadCsvContent(fileReader, filepath.Base(path))
	if err != nil {
		response.Error = err
		return response
	}
	response.Frames = data.Frames{frame}
	return response
}

func (s *Service) doRandomWalk(query backend.DataQuery) backend.DataResponse {
	response := backend.DataResponse{}

	model := simplejson.New()
	response.Frames = data.Frames{testdatasource.RandomWalk(query, model, 0)}

	return response
}
