package expr

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

// DatasourceType is the string constant used as the datasource when the property is in Datasource.Type.
// Type in requests is used to identify what type of data source plugin the request belongs to.
const DatasourceType = "__expr__"

// DatasourceUID is the string constant used as the datasource name in requests
// to identify it as an expression command when use in Datasource.UID.
const DatasourceUID = DatasourceType

// DatasourceID is the fake datasource id used in requests to identify it as an
// expression command.
const DatasourceID = -100

// OldDatasourceUID is the datasource uid used in requests to identify it as an
// expression command. It goes with the query root level datasourceUID property. It was accidentally
// set to the Id and is now kept for backwards compatibility. The newer Datasource.UID property
// should be used instead and should be set to "__expr__".
const OldDatasourceUID = "-100"

// IsDataSource checks if the uid points to an expression query
func IsDataSource(uid string) bool {
	return uid == DatasourceUID || uid == OldDatasourceUID
}

// Service is service representation for expression handling.
type Service struct {
	cfg               *setting.Cfg
	dataService       backend.QueryDataHandler
	dataSourceService datasources.DataSourceService
}

func ProvideService(cfg *setting.Cfg, pluginClient plugins.Client, dataSourceService datasources.DataSourceService) *Service {
	return &Service{
		cfg:               cfg,
		dataService:       pluginClient,
		dataSourceService: dataSourceService,
	}
}

func (s *Service) isDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.ExpressionsEnabled
}

// BuildPipeline builds a pipeline from a request.
func (s *Service) BuildPipeline(req *Request) (DataPipeline, error) {
	return s.buildPipeline(req)
}

// ExecutePipeline executes an expression pipeline and returns all the results.
func (s *Service) ExecutePipeline(ctx context.Context, pipeline DataPipeline) (*Response, error) {
	res := NewResponse()
	vars, err := pipeline.execute(ctx, s)
	if err != nil {
		return nil, err
	}
	for refID, val := range vars {
		resp := DataResponse{
			Frames:  val.Values.AsDataFrames(refID),
			Notices: val.Notices,
		}
		res.Responses[refID] = resp
	}
	return res, nil
}

func DataSourceModel() *models.DataSource {
	return &models.DataSource{
		Id:             DatasourceID,
		Uid:            DatasourceUID,
		Name:           DatasourceUID,
		Type:           DatasourceType,
		JsonData:       simplejson.New(),
		SecureJsonData: make(map[string][]byte),
	}
}

type DataResponse struct {
	Frames  data.Frames   `json:"frames"`
	Error   error         `json:"error,omitempty"`
	Notices []data.Notice `json:"notices,omitempty"`
}

type Response struct {
	// Responses is a map of RefIDs (Unique Query ID) to *DataResponse.
	Responses map[string]DataResponse `json:"results"`
}

func NewResponse() *Response {
	return &Response{Responses: make(map[string]DataResponse)}
}

func FromBackendResponse(resp *backend.QueryDataResponse) *Response {
	if resp == nil {
		return nil
	}
	r := NewResponse()
	for key, rsp := range resp.Responses {
		r.Responses[key] = DataResponse{
			Frames:  rsp.Frames,
			Error:   rsp.Error,
			Notices: nil,
		}
	}
	return r
}
