package expr

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	jsoniter "github.com/json-iterator/go"
	"gonum.org/v1/gonum/graph/simple"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/ml"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

var (
	errMLPluginDoesNotExist = errors.New("expression type Machine Learning cannot be executed. Plugin 'grafana-ml-app' must be installed and initialized")
)

const (
	mlDatasourceID = -200

	// DatasourceUID is the string constant used as the datasource name in requests
	// to identify it as an expression command when use in Datasource.UID.
	MLDatasourceUID = "__ml__"

	mlPluginID = "grafana-ml-app"
)

// MLNode is a node of expression tree that evaluates the expression by sending the payload to Machine Learning back-end.
// See ml.UnmarshalCommand for supported commands.
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

// Execute initializes plugin API client,  executes a ml.Command and then converts the result of the execution.
// Returns non-empty mathexp.Results if evaluation was successful. Returns QueryError if command execution failed
func (m *MLNode) Execute(ctx context.Context, now time.Time, _ mathexp.Vars, s *Service) (r mathexp.Results, e error) {
	logger := logger.FromContext(ctx).New("datasourceType", mlPluginID, "queryRefId", m.refID)
	var result mathexp.Results
	timeRange := m.TimeRange.AbsoluteTime(now)

	// get the plugin configuration that will be used by client (auth, host, etc)
	pCtx, err := s.pCtxProvider.Get(ctx, mlPluginID, m.request.User, m.request.OrgId)
	if err != nil {
		if errors.Is(err, plugincontext.ErrPluginNotFound) {
			return result, errMLPluginDoesNotExist
		}
		return result, fmt.Errorf("failed to get plugin settings: %w", err)
	}

	// Plugin must be initialized by the admin first. This will create service account and let other use it.
	if pCtx.AppInstanceSettings == nil || !jsoniter.Get(pCtx.AppInstanceSettings.JSONData, "initialized").ToBool() {
		return mathexp.Results{}, errMLPluginDoesNotExist
	}

	// responseType and respStatus will be updated below. Use defer to ensure that debug log message is always emitted
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

		// copy headers from the original request. Usually this contains information from upstream, e.g. FromAlert
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

	// data is not guaranteed to be specified. In this case simulate NoData scenario
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
