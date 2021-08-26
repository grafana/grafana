package grafana

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
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
)

// GrafanaDatasource exists regardless of user settings
type GrafanaDatasource struct {
	// path to the public folder
	StaticRootPath string
	OKRoots        []string
}

// Make sure GrafanaDatasource implements required interfaces.
// This is important to do since otherwise we will only get a
// not implemented error response from plugin in runtime.
var (
	_ backend.QueryDataHandler   = (*GrafanaDatasource)(nil)
	_ backend.CheckHealthHandler = (*GrafanaDatasource)(nil)
)

// NewGrafanaDatasource creates a new datasource instance.
func NewGrafanaDatasource() *GrafanaDatasource {
	return &GrafanaDatasource{}
}

func (ds *GrafanaDatasource) QueryData(_ context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		switch q.QueryType {
		case QueryTypeList:
			response.Responses[q.RefID] = ds.doListQuery(q)
		default:
			response.Responses[q.RefID] = backend.DataResponse{
				Error: fmt.Errorf("unknown query type"),
			}
		}
	}

	return response, nil
}

func (ds *GrafanaDatasource) CheckHealth(_ context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "OK",
	}, nil
}

func (ds *GrafanaDatasource) getPublicPath(path string) (string, error) {
	if strings.Contains(path, "..") {
		return "", fmt.Errorf("invalid string")
	}

	ok := false
	for _, root := range ds.OKRoots {
		if strings.HasPrefix(path, root) {
			ok = true
			break
		}
	}
	if !ok {
		return "", fmt.Errorf("bad root path")
	}
	return filepath.Join(ds.StaticRootPath, path), nil
}

func (ds *GrafanaDatasource) doListQuery(query backend.DataQuery) backend.DataResponse {
	q := &ListQueryModel{}
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

func (ds *GrafanaDatasource) doReadQuery(query backend.DataQuery) backend.DataResponse {
	q := &ListQueryModel{}
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
