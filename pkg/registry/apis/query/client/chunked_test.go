package client

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	dataapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	queryapi "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func setChunkedTypes(t *testing.T, value any) {
	t.Helper()
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		chunked.QueryTypesFlag: {State: memprovider.Enabled, DefaultVariant: "value", Variants: map[string]any{"value": value}},
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
}

type testPluginClient struct {
	plugins.Client
	unary     func(context.Context, *backend.QueryDataRequest) (*backend.QueryDataResponse, error)
	streaming func(context.Context, *backend.QueryChunkedDataRequest, backend.ChunkedDataWriter) error
}

func (p testPluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return p.unary(ctx, req)
}
func (p testPluginClient) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	return p.streaming(ctx, req, w)
}

type testPluginContext struct {
	calls          int
	datasourceType string
	err            error
}

func (p *testPluginContext) GetDataSourceInstanceSettings(_ context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	p.calls++
	if p.err != nil {
		return nil, p.err
	}
	return &backend.DataSourceInstanceSettings{UID: uid, Type: p.datasourceType}, nil
}
func (p *testPluginContext) PluginContextForDataSource(_ context.Context, ds *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return backend.PluginContext{OrgID: 42, PluginID: ds.Type, DataSourceInstanceSettings: ds}, nil
}

type testAccessControl struct {
	accesscontrol.AccessControl
	allowed bool
	err     error
	calls   int
}

func (a *testAccessControl) Evaluate(context.Context, identity.Requester, accesscontrol.Evaluator) (bool, error) {
	a.calls++
	return a.allowed, a.err
}

func testRequest(t *testing.T) dataapi.QueryDataRequest {
	t.Helper()
	var request dataapi.QueryDataRequest
	require.NoError(t, json.Unmarshal([]byte(`{"from":"0","to":"1000","queries":[{"refId":"A","datasource":{"uid":"one","type":"test"},"test":"value"},{"refId":"B","datasource":{"uid":"one","type":"test"}}]}`), &request))
	return request
}
func requesterContext() context.Context {
	return identity.WithRequester(context.Background(), &identity.StaticRequester{})
}

func TestPluginClientChunkedSelection(t *testing.T) {
	for _, tc := range []struct {
		name, dsType string
		flag         any
		streamed     bool
	}{
		{"enabled", "test", map[string]any{"types": []any{"test"}}, true},
		{"other type", "other", map[string]any{"types": []any{"test"}}, false},
		{"empty list", "test", map[string]any{"types": []any{}}, false},
		{"malformed list", "test", map[string]any{"types": []any{"test", 1}}, false},
		{"malformed flag", "test", "invalid", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setChunkedTypes(t, tc.flag)
			streamed, unary := 0, 0
			permission := &testAccessControl{allowed: true}
			contextProvider := &testPluginContext{datasourceType: tc.dsType}
			client := pluginClient{ac: permission, pCtxProvider: contextProvider, pluginClient: testPluginClient{
				unary: func(_ context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
					unary++
					require.Equal(t, tc.dsType, req.PluginContext.PluginID)
					require.Len(t, req.Queries, 2)
					return &backend.QueryDataResponse{Responses: backend.Responses{}}, nil
				},
				streaming: func(_ context.Context, req *backend.QueryChunkedDataRequest, _ backend.ChunkedDataWriter) error {
					streamed++
					require.Equal(t, tc.dsType, req.PluginContext.PluginID)
					require.EqualValues(t, 42, req.PluginContext.OrgID)
					require.Equal(t, "one", req.PluginContext.DataSourceInstanceSettings.UID)
					require.Equal(t, backend.DataFrameFormat_JSON, req.Format)
					require.Len(t, req.Queries, 2)
					require.Contains(t, string(req.Queries[0].JSON), `"test":"value"`)
					return nil
				},
			}}
			response, err := client.QueryData(requesterContext(), testRequest(t))
			require.NoError(t, err)
			if tc.streamed {
				require.Len(t, response.Responses, 2)
				require.Equal(t, backend.StatusOK, response.Responses["A"].Status)
				require.Equal(t, backend.StatusOK, response.Responses["B"].Status)
			} else {
				require.Empty(t, response.Responses)
			}
			require.Equal(t, 1, permission.calls)
			require.Equal(t, 1, contextProvider.calls)
			if tc.streamed {
				require.Equal(t, 1, streamed)
				require.Zero(t, unary)
			} else {
				require.Equal(t, 1, unary)
				require.Zero(t, streamed)
			}
		})
	}
}

func TestPluginClientChunkedDefaultsOff(t *testing.T) {
	require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{}))
	require.False(t, chunked.UseChunkedQuery(context.Background(), "test"))
}

func TestPluginClientChunkedAuthorizationAndLookup(t *testing.T) {
	for _, tc := range []struct {
		name                        string
		allowed                     bool
		authErr, lookupErr, errorIs error
	}{
		{name: "denied", errorIs: k8sForbiddenError},
		{name: "authorization failure", authErr: context.Canceled, errorIs: context.Canceled},
		{name: "settings failure", allowed: true, lookupErr: plugins.ErrPluginNotRegistered, errorIs: plugins.ErrPluginNotRegistered},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setChunkedTypes(t, map[string]any{"types": []any{"test"}})
			permission := &testAccessControl{allowed: tc.allowed, err: tc.authErr}
			contexts := &testPluginContext{datasourceType: "test", err: tc.lookupErr}
			client := pluginClient{ac: permission, pCtxProvider: contexts, pluginClient: testPluginClient{
				unary: func(context.Context, *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
					t.Fatal("unexpected unary call")
					return nil, nil
				},
				streaming: func(context.Context, *backend.QueryChunkedDataRequest, backend.ChunkedDataWriter) error {
					t.Fatal("unexpected streaming call")
					return nil
				},
			}}
			response, err := client.QueryData(requesterContext(), testRequest(t))
			require.Nil(t, response)
			require.ErrorIs(t, err, tc.errorIs)
			if !tc.allowed {
				require.Zero(t, contexts.calls)
			}
		})
	}
}

func TestPluginClientChunkedParity(t *testing.T) {
	setChunkedTypes(t, map[string]any{"types": []any{"test"}})
	frame := data.NewFrame("result", data.NewField("value", nil, []int64{1, 2, 3}))
	frame.RefID = "A"
	expected := &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{frame}, Status: backend.StatusOK},
		"B": {Error: errors.New("denied"), Status: backend.StatusForbidden, ErrorSource: backend.ErrorSourceDownstream},
	}}
	client := pluginClient{ac: &testAccessControl{allowed: true}, pCtxProvider: &testPluginContext{datasourceType: "test"}, pluginClient: testPluginClient{
		streaming: func(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
			raw := w.(chunked.RawChunkReceiver)
			writer := backend.NewChunkedDataWriter(req.Format, raw.OnChunk)
			require.NoError(t, writer.WriteFrame(ctx, "A", "0", data.NewFrame("result", data.NewField("value", nil, []int64{1}))))
			require.NoError(t, writer.WriteFrame(ctx, "A", "0", data.NewFrame("result", data.NewField("value", nil, []int64{2, 3}))))
			require.NoError(t, writer.WriteError(ctx, "B", backend.StatusForbidden, backend.DownstreamError(errors.New("denied"))))
			return nil
		},
	}}
	actual, err := client.QueryData(requesterContext(), testRequest(t))
	require.NoError(t, err)
	expectedJSON, err := json.Marshal(expected)
	require.NoError(t, err)
	actualJSON, err := json.Marshal(actual)
	require.NoError(t, err)
	require.JSONEq(t, string(expectedJSON), string(actualJSON))
}

func TestPluginClientChunkedFailureDiscardsPartialResponse(t *testing.T) {
	for _, streamErr := range []error{errors.New("stream failed"), context.Canceled, context.DeadlineExceeded} {
		t.Run(streamErr.Error(), func(t *testing.T) {
			setChunkedTypes(t, map[string]any{"types": []any{"test"}})
			calls := 0
			client := pluginClient{ac: &testAccessControl{allowed: true}, pCtxProvider: &testPluginContext{datasourceType: "test"}, pluginClient: testPluginClient{
				streaming: func(ctx context.Context, _ *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
					calls++
					require.NoError(t, w.WriteFrame(ctx, "A", "0", data.NewFrame("result", data.NewField("value", nil, []int64{1}))))
					return streamErr
				},
			}}
			response, err := client.QueryData(requesterContext(), testRequest(t))
			require.Nil(t, response)
			require.ErrorIs(t, err, streamErr)
			require.Equal(t, 1, calls)
		})
	}
}

type captureProvider struct {
	openfeature.NoopProvider
	evaluation openfeature.FlattenedContext
}

func (p *captureProvider) ObjectEvaluation(_ context.Context, _ string, _ any, evaluation openfeature.FlattenedContext) openfeature.InterfaceResolutionDetail {
	p.evaluation = evaluation
	return openfeature.InterfaceResolutionDetail{Value: map[string]any{"types": []any{"test"}}}
}
func TestPluginClientChunkedTenantContext(t *testing.T) {
	provider := &captureProvider{}
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	ctx := openfeature.MergeTransactionContext(context.Background(), openfeature.NewEvaluationContext("", map[string]any{"stackId": "42"}))
	ctx = request.WithRequestInfo(ctx, &request.RequestInfo{Namespace: "default"})
	require.True(t, chunked.UseChunkedQuery(ctx, "test"))
	require.Equal(t, "default", provider.evaluation["namespace"])
	require.Equal(t, "default", provider.evaluation["targetingKey"])
	require.Equal(t, "42", provider.evaluation["stackId"])
}

func TestChunkedQueryCollectorFrames(t *testing.T) {
	collector := chunked.NewQueryResponseCollector()
	for _, tc := range []struct {
		ref, id string
		value   int64
	}{{"A", "0", 1}, {"B", "0", 2}, {"A", "1", 3}, {"A", "0", 4}, {"A", "", 5}, {"A", "", 6}} {
		require.NoError(t, collector.WriteFrame(context.Background(), tc.ref, tc.id, data.NewFrame("result", data.NewField("value", nil, []int64{tc.value}))))
	}
	require.Len(t, collector.Response().Responses["A"].Frames, 4)
	require.Len(t, collector.Response().Responses["B"].Frames, 1)
	frame := collector.Response().Responses["A"].Frames[0]
	require.Equal(t, "A", frame.RefID)
	require.Equal(t, 2, frame.Fields[0].Len())
	require.EqualValues(t, 1, frame.Fields[0].At(0))
	require.EqualValues(t, 4, frame.Fields[0].At(1))
	require.EqualValues(t, 2, collector.Response().Responses["B"].Frames[0].Fields[0].At(0))
}

func TestChunkedQueryCollectorErrors(t *testing.T) {
	for _, tc := range []struct {
		name  string
		chunk *pluginv2.QueryChunkedDataResponse
	}{
		{"nil event", nil},
		{"missing ref", &pluginv2.QueryChunkedDataResponse{}},
		{"invalid JSON", &pluginv2.QueryChunkedDataResponse{RefId: "A", Frame: []byte("invalid"), Format: pluginv2.DataFrameFormat_JSON}},
		{"unexpected format", &pluginv2.QueryChunkedDataResponse{RefId: "A", Frame: []byte("{}"), Format: pluginv2.DataFrameFormat_ARROW}},
		{"missing initial schema", &pluginv2.QueryChunkedDataResponse{RefId: "A", FrameId: "0", Frame: []byte(`{"data":{"values":[[1]]}}`), Format: pluginv2.DataFrameFormat_JSON}},
	} {
		t.Run(tc.name, func(t *testing.T) { require.Error(t, chunked.NewQueryResponseCollector().OnChunk(tc.chunk)) })
	}
	collector := chunked.NewQueryResponseCollector()
	require.NoError(t, collector.WriteFrame(context.Background(), "A", "0", data.NewFrame("result", data.NewField("value", nil, []int64{1}))))
	require.ErrorContains(t, collector.WriteFrame(context.Background(), "A", "0", data.NewFrame("result", data.NewField("value", nil, []string{"changed"}))), "appending chunked query frame")
	require.ErrorContains(t, collector.WriteFrame(context.Background(), "A", "0", data.NewFrame("result")), "field count changed")
}

func TestChunkedQueryCollectorTypedErrorSource(t *testing.T) {
	collector := chunked.NewQueryResponseCollector()
	require.NoError(t, collector.WriteError(context.Background(), "A", backend.StatusForbidden, backend.DownstreamError(errors.New("denied"))))
	require.Equal(t, backend.StatusForbidden, collector.Response().Responses["A"].Status)
	require.Equal(t, backend.ErrorSourceDownstream, collector.Response().Responses["A"].ErrorSource)
	require.EqualError(t, collector.Response().Responses["A"].Error, "denied")
}

type streamingDataServer struct {
	pluginv2.UnimplementedDataServer
	chunks    []*pluginv2.QueryChunkedDataResponse
	streamErr error
}

func (s *streamingDataServer) QueryChunkedData(req *pluginv2.QueryChunkedDataRequest, stream grpc.ServerStreamingServer[pluginv2.QueryChunkedDataResponse]) error {
	if req.Format != pluginv2.DataFrameFormat_JSON {
		return status.Error(codes.InvalidArgument, "expected JSON request")
	}
	for _, chunk := range s.chunks {
		if err := stream.Send(chunk); err != nil {
			return err
		}
	}
	return s.streamErr
}

func TestPluginClientChunkedGRPC(t *testing.T) {
	for _, name := range []string{"complete", "interrupted", "arrow"} {
		t.Run(name, func(t *testing.T) {
			setChunkedTypes(t, map[string]any{"types": []any{"test"}})
			frameBytes, err := data.NewFrame("result", data.NewField("value", nil, []int64{42})).MarshalJSON()
			require.NoError(t, err)
			format := pluginv2.DataFrameFormat_JSON
			if name == "arrow" {
				frameBytes, err = data.NewFrame("result", data.NewField("value", nil, []int64{42})).MarshalArrow()
				require.NoError(t, err)
				format = pluginv2.DataFrameFormat_ARROW
			}
			dataServer := &streamingDataServer{chunks: []*pluginv2.QueryChunkedDataResponse{
				{RefId: "A", FrameId: "0", Format: format, Frame: frameBytes, Status: 200},
				{RefId: "B", Status: 403, Error: "denied", ErrorSource: "downstream"},
			}}
			if name == "interrupted" {
				dataServer.streamErr = status.Error(codes.Unavailable, "plugin stopped")
			}
			listener := bufconn.Listen(1024 * 1024)
			server := grpc.NewServer()
			pluginv2.RegisterDataServer(server, dataServer)
			go func() { _ = server.Serve(listener) }()
			t.Cleanup(func() { server.Stop(); _ = listener.Close() })
			conn, err := grpc.NewClient("passthrough:///plugin", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }))
			require.NoError(t, err)
			t.Cleanup(func() { _ = conn.Close() })
			grpcClient := &grpcplugin.ClientV2{DataClient: pluginv2.NewDataClient(conn)}
			client := pluginClient{ac: &testAccessControl{allowed: true}, pCtxProvider: &testPluginContext{datasourceType: "test"}, pluginClient: testPluginClient{
				streaming: grpcClient.QueryChunkedData,
			}}
			response, err := client.QueryData(requesterContext(), testRequest(t))
			if name == "interrupted" {
				require.Nil(t, response)
				require.Equal(t, codes.Unavailable, status.Code(err))
				return
			}
			if name == "arrow" {
				require.ErrorContains(t, err, "expected JSON chunked query frame")
				require.Nil(t, response)
				return
			}
			require.NoError(t, err)
			require.EqualValues(t, 42, response.Responses["A"].Frames[0].Fields[0].At(0))
			require.Equal(t, backend.StatusForbidden, response.Responses["B"].Status)
			require.Equal(t, backend.ErrorSourceDownstream, response.Responses["B"].ErrorSource)
			require.EqualError(t, response.Responses["B"].Error, "denied")
		})
	}
}

func TestPluginClientChunkedRejectsArrow(t *testing.T) {
	setChunkedTypes(t, map[string]any{"types": []any{"test"}})
	frameBytes, err := data.NewFrame("result", data.NewField("value", nil, []int64{42})).MarshalArrow()
	require.NoError(t, err)
	calls := 0
	client := pluginClient{ac: &testAccessControl{allowed: true}, pCtxProvider: &testPluginContext{datasourceType: "test"}, pluginClient: testPluginClient{
		unary: func(context.Context, *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			t.Fatal("unexpected unary fallback")
			return nil, nil
		},
		streaming: func(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
			calls++
			require.Equal(t, backend.DataFrameFormat_JSON, req.Format)
			writer := backend.NewChunkedDataWriter(req.Format, w.(chunked.RawChunkReceiver).OnChunk)
			require.NoError(t, writer.WriteFrame(ctx, "A", "0", data.NewFrame("result", data.NewField("value", nil, []int64{1}))))
			return w.(chunked.RawChunkReceiver).OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "A", FrameId: "0", Frame: frameBytes, Format: pluginv2.DataFrameFormat_ARROW})
		},
	}}
	response, err := client.QueryData(requesterContext(), testRequest(t))
	require.ErrorContains(t, err, "expected JSON chunked query frame")
	require.Nil(t, response)
	require.Equal(t, 1, calls)
}

func TestPluginClientChunkedSDKErrorSourceAndHTTPStatus(t *testing.T) {
	for _, coreFallback := range []bool{false, true} {
		name := "native"
		if coreFallback {
			name = "core fallback"
		}
		t.Run(name, func(t *testing.T) {
			setChunkedTypes(t, map[string]any{"types": []any{"test"}})
			client := pluginClient{ac: &testAccessControl{allowed: true}, pCtxProvider: &testPluginContext{datasourceType: "test"}, pluginClient: testPluginClient{
				streaming: func(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
					writer := backend.NewChunkedDataWriter(req.Format, w.(chunked.RawChunkReceiver).OnChunk)
					if coreFallback {
						return chunked.ProcessTypedResponse(ctx, &backend.QueryDataResponse{Responses: backend.Responses{"A": {Error: errors.New("bad SQL"), Status: backend.StatusInternal, ErrorSource: backend.ErrorSourceDownstream}}}, writer)
					}
					return writer.WriteError(ctx, "A", backend.StatusInternal, backend.DownstreamError(errors.New("bad SQL")))
				},
			}}
			response, err := client.QueryData(requesterContext(), testRequest(t))
			require.NoError(t, err)
			require.Equal(t, backend.ErrorSourceDownstream, response.Responses["A"].ErrorSource)
			require.Equal(t, 400, queryapi.GetResponseCode(response))
			require.Contains(t, response.Responses, "B")
		})
	}
}
