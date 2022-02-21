package grafanads

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/searchV2"
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

// Make sure Service implements required interfaces.
// This is important to do since otherwise we will only get a
// not implemented error response from plugin at runtime.
var (
	_      backend.QueryDataHandler   = (*Service)(nil)
	_      backend.CheckHealthHandler = (*Service)(nil)
	logger                            = log.New("tsdb.grafana")
)

func ProvideService(cfg *setting.Cfg, search searchV2.SearchService, fs filestorage.FileStorage) *Service {
	return newService(cfg, search, fs)
}

func newService(cfg *setting.Cfg, search searchV2.SearchService, fs filestorage.FileStorage) *Service {
	s := &Service{
		fs:             fs,
		search:         search,
		staticRootPath: cfg.StaticRootPath,
		roots: []string{
			"testdata",
			"img/icons",
			"img/bg",
			"gazetteer",
			"maps",
			"upload", // does not exist yet
		},
		log: log.New("grafanads"),
	}

	return s
}

// Service exists regardless of user settings
type Service struct {
	// path to the public folder
	staticRootPath string
	roots          []string
	search         searchV2.SearchService
	fs             filestorage.FileStorage
	log            log.Logger
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

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		switch q.QueryType {
		case queryTypeRandomWalk:
			response.Responses[q.RefID] = s.doRandomWalk(q)
		case queryTypeList:
			response.Responses[q.RefID] = s.doListQuery(q)
		case queryTypeRead:
			response.Responses[q.RefID] = s.doReadQuery(q)
		case queryTypeSearch:
			response.Responses[q.RefID] = s.doSearchQuery(ctx, req, q)
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

func (s *Service) getDirectoryFrame(p string, details bool) (*data.Frame, error) {
	// Name() string       // base name of the file
	// Size() int64        // length in bytes for regular files; system-dependent for others
	// Mode() FileMode     // file mode bits
	// ModTime() time.Time // modification time
	// IsDir() bool        // abbreviation for Mode().IsDir()
	ctx := context.Background()
	path := filestorage.Path(p, filestorage.StorageNameGrafanaDS)
	folders, err := s.fs.ListFolders(ctx, path, &filestorage.ListOptions{Recursive: false})
	if err != nil {
		s.log.Error("failed when listing folders", "path", path, "err", err)
		return nil, errors.New("unknown error")
	}

	filesResp, err := s.fs.ListFiles(ctx, path, nil, &filestorage.ListOptions{Recursive: false})
	if err != nil {
		s.log.Error("failed when listing files", "path", path, "err", err)
		return nil, errors.New("unknown error")
	}

	count := len(filesResp.Files) + len(folders)
	names := data.NewFieldFromFieldType(data.FieldTypeString, count)
	mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
	size := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
	modified := data.NewFieldFromFieldType(data.FieldTypeTime, count)

	names.Name = "name"
	mtype.Name = "media-type"
	size.Name = "size"
	size.Config = &data.FieldConfig{
		Unit: "bytes",
	}
	modified.Name = "modified"

	for i, f := range filesResp.Files {
		names.Set(i, f.Name)
		mtype.Set(i, f.MimeType)
		if details {
			size.Set(i, f.Size)
			modified.Set(i, f.Modified)
		}
	}

	for i, f := range folders {
		names.Set(i, f.FullPath)
		mtype.Set(i, "directory")
	}

	frame := data.NewFrame("", names, mtype)
	frame.SetMeta(&data.FrameMeta{
		PathSeparator: filestorage.Delimiter,
		Type:          data.FrameTypeDirectoryListing,
	})
	if details {
		frame.Fields = append(frame.Fields, size)
		frame.Fields = append(frame.Fields, modified)
	}
	return frame, nil
}

func (s *Service) doListQuery(query backend.DataQuery) backend.DataResponse {
	q := &listQueryModel{}
	response := backend.DataResponse{}
	err := json.Unmarshal(query.JSON, &q)
	if err != nil {
		response.Error = err
		return response
	}

	path := q.Path
	if path == "" {
		rootPath := filestorage.Path(filestorage.Delimiter, filestorage.StorageNameGrafanaDS)
		folders, err := s.fs.ListFolders(context.Background(), rootPath, nil)
		if err != nil {
			s.log.Error("failed when listing folders", "path", rootPath, "err", err)
			response.Error = errors.New("unknown error")
			return response
		}

		count := len(folders)
		names := data.NewFieldFromFieldType(data.FieldTypeString, count)
		mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
		names.Name = "name"
		mtype.Name = "mediaType"
		for i, f := range folders {
			names.Set(i, f.FullPath)
			mtype.Set(i, "directory")
		}
		frame := data.NewFrame("", names, mtype)
		frame.SetMeta(&data.FrameMeta{
			Type: data.FrameTypeDirectoryListing,
		})
		response.Frames = data.Frames{frame}
	} else {
		frame, err := s.getDirectoryFrame(path, true)
		if err != nil {
			response.Error = err
			return response
		}
		response.Frames = data.Frames{frame}
	}

	return response
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
		s.log.Error("Failed to read file", "err", err, "path", path)
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

func (s *Service) doSearchQuery(ctx context.Context, req *backend.QueryDataRequest, query backend.DataQuery) backend.DataResponse {
	q := searchV2.DashboardQuery{}
	err := json.Unmarshal(query.JSON, &q)
	if err != nil {
		return backend.DataResponse{
			Error: err,
		}
	}

	return *s.search.DoDashboardQuery(ctx, req.PluginContext.User, req.PluginContext.OrgID, q)
}
