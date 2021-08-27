package builtin

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
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
)

func ProvideService(cfg *setting.Cfg) *BuiltinGrafanaDatasource {
	return newBuiltinGrafanaDatasource(cfg.StaticRootPath)
}

func newBuiltinGrafanaDatasource(staticRootPath string) *BuiltinGrafanaDatasource {
	logger := log.New("tsdb.grafana")
	ds := &BuiltinGrafanaDatasource{
		logger:         logger,
		staticRootPath: staticRootPath,
		roots: []string{
			"testdata",
			"img/icons",
			"img/bg",
			"gazetteer",
			"upload", // does not exist yet
		},
	}
	return ds
}

// BuiltinGrafanaDatasource exists regardless of user settings
type BuiltinGrafanaDatasource struct {
	// path to the public folder
	staticRootPath string
	logger         log.Logger
	roots          []string
}

// Make sure BuiltinGrafanaDatasource implements required interfaces.
// This is important to do since otherwise we will only get a
// not implemented error response from plugin in runtime.
var (
	_ backend.QueryDataHandler   = (*BuiltinGrafanaDatasource)(nil)
	_ backend.CheckHealthHandler = (*BuiltinGrafanaDatasource)(nil)
)

func (ds *BuiltinGrafanaDatasource) QueryData(_ context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		switch q.QueryType {
		case queryTypeRandomWalk:
			response.Responses[q.RefID] = ds.doRandomWalk(q)
		case queryTypeList:
			response.Responses[q.RefID] = ds.doListQuery(q)
		case queryTypeRead:
			response.Responses[q.RefID] = ds.doReadQuery(q)
		default:
			response.Responses[q.RefID] = backend.DataResponse{
				Error: fmt.Errorf("unknown query type"),
			}
		}
	}

	return response, nil
}

func (ds *BuiltinGrafanaDatasource) CheckHealth(_ context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "OK",
	}, nil
}

func (ds *BuiltinGrafanaDatasource) getPublicPath(path string) (string, error) {
	if strings.Contains(path, "..") {
		return "", fmt.Errorf("invalid string")
	}

	ok := false
	for _, root := range ds.roots {
		if strings.HasPrefix(path, root) {
			ok = true
			break
		}
	}
	if !ok {
		return "", fmt.Errorf("bad root path")
	}
	return filepath.Join(ds.staticRootPath, path), nil
}

func (ds *BuiltinGrafanaDatasource) doListQuery(query backend.DataQuery) backend.DataResponse {
	q := &listQueryModel{}
	response := backend.DataResponse{}
	err := json.Unmarshal(query.JSON, &q)
	if err != nil {
		response.Error = err
		return response
	}

	path, err := ds.getPublicPath(q.Path)
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
	return response
}

func (ds *BuiltinGrafanaDatasource) doReadQuery(query backend.DataQuery) backend.DataResponse {
	q := &listQueryModel{}
	response := backend.DataResponse{}
	err := json.Unmarshal(query.JSON, &q)
	if err != nil {
		response.Error = err
		return response
	}

	if !strings.HasSuffix(q.Path, ".csv") {
		response.Error = fmt.Errorf("unsupported file type")
		return response
	}

	path, err := ds.getPublicPath(q.Path)
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
			ds.logger.Warn("Failed to close file", "err", err, "path", path)
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

func (ds *BuiltinGrafanaDatasource) doRandomWalk(query backend.DataQuery) backend.DataResponse {
	response := backend.DataResponse{}
	// TODO!!!!
	return response
}
