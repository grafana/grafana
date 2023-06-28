package expr

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"gonum.org/v1/gonum/graph/simple"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/ml"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

var errMLPluginDoesNotExist = errors.New("expression type Machine Learning is not supported. Plugin 'grafana-ml-app' must be enabled")

const (
	mlDatasourceID = -200

	// DatasourceUID is the string constant used as the datasource name in requests
	// to identify it as an expression command when use in Datasource.UID.
	MLDatasourceUID = "__ml__"

	mlPluginID = "grafana-ml-app"
)

type MLNode struct {
	baseNode
	command   ml.Command
	TimeRange TimeRange
	request   *Request
}

// NodeType returns the data pipeline node type.
func (m *MLNode) NodeType() NodeType {
	return TypeMLNode
}

// Execute runs ml.Command command and converts the response to mathexp.Results
func (m *MLNode) Execute(ctx context.Context, now time.Time, _ mathexp.Vars, s *Service) (r mathexp.Results, e error) {
	logger := logger.FromContext(ctx).New("datasourceType", mlPluginID, "queryRefId", m.refID)
	var result mathexp.Results
	timeRange := m.TimeRange.AbsoluteTime(now)

	pCtx, err := s.pCtxProvider.Get(ctx, mlPluginID, m.request.User, m.request.OrgId)
	if err != nil {
		if errors.Is(err, plugincontext.ErrPluginNotFound) {
			return result, errMLPluginDoesNotExist
		}
		return result, fmt.Errorf("failed to get plugin settings: %w", err)
	}

	responseType := "unknown"
	respStatus := "success"
	defer func() {
		if e != nil {
			responseType = "error"
			respStatus = "failure"
		}
		logger.Debug("Data source queried", "responseType", responseType)
		useDataplane := strings.HasPrefix("dataplane-", responseType)
		s.metrics.dsRequests.WithLabelValues(respStatus, fmt.Sprintf("%t", useDataplane)).Inc()
	}()

	data, err := m.command.Execute(timeRange.From, timeRange.To, func(method string, path string, payload []byte) (response.Response, error) {
		crReq := &backend.CallResourceRequest{
			PluginContext: pCtx,
			Path:          path,
			Method:        method,
			URL:           path,
			Headers:       make(map[string][]string, len(m.request.Headers)),
			Body:          payload,
		}

		for key, val := range m.request.Headers {
			crReq.SetHTTPHeader(key, val)
		}

		resp := response.CreateNormalResponse(make(http.Header), nil, 0)
		httpSender := httpresponsesender.New(resp)
		err = s.pluginsClient.CallResource(ctx, crReq, httpSender)
		if err != nil {
			return nil, err
		}
		return resp, nil
	})

	if err != nil {
		return result, QueryError{
			RefID: m.refID,
			Err:   err,
		}
	}

	if data == nil {
		data = &backend.QueryDataResponse{Responses: map[string]backend.DataResponse{}}
	}

	responseType, result, err = queryDataResponseToResults(ctx, data, m.refID, mlPluginID, s)
	return result, err
}

func (s *Service) buildMLNode(dp *simple.DirectedGraph, rn *rawNode, req *Request) (Node, error) {
	if rn.TimeRange == nil {
		return nil, errors.New("time range must be specified")
	}

	cmd, err := ml.UnmarshalCommand(rn.Query, s.cfg.AppURL)
	if err != nil {
		return nil, err
	}

	return &MLNode{
		baseNode: baseNode{
			id:    dp.NewNode().ID(),
			refID: rn.RefID,
		},
		TimeRange: rn.TimeRange,
		command:   cmd,
		request:   req,
	}, nil
}
