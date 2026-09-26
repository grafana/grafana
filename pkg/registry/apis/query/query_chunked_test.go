package query

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	dataapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	queryapi "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type chunkedInstance struct {
	clientapi.Instance
	enabled   bool
	denied    bool
	streamErr error
	called    bool
}

func (i *chunkedInstance) GetSettings() clientapi.InstanceConfigurationSettings {
	features := featuremgmt.WithFeatures()
	if i.enabled {
		features = featuremgmt.WithFeatures(featuremgmt.FlagDatasourcesChunkedQueryStreaming)
	}
	return clientapi.InstanceConfigurationSettings{FeatureToggles: features}
}
func (i *chunkedInstance) GetDataSourceClient(context.Context, dataapi.DataSourceRef) (clientapi.QueryDataClient, error) {
	if i.denied {
		return nil, apierrors.NewForbidden(schema.GroupResource{Resource: "datasources"}, "oracle", errors.New("denied"))
	}
	return i, nil
}
func (i *chunkedInstance) ReportMetrics() {}
func (i *chunkedInstance) QueryData(context.Context, dataapi.QueryDataRequest) (*backend.QueryDataResponse, error) {
	panic("unexpected unary request")
}
func (i *chunkedInstance) QueryChunkedData(_ context.Context, _ dataapi.QueryDataRequest, r chunked.RawChunkReceiver) error {
	i.called = true
	if err := r.OnChunk(&pluginv2.QueryChunkedDataResponse{RefId: "A", FrameId: "1", Frame: []byte(`{"schema":{},"data":{}}`), Format: pluginv2.DataFrameFormat_JSON}); err != nil {
		return err
	}
	return i.streamErr
}

type chunkedInstanceProvider struct {
	clientapi.InstanceProvider
	i *chunkedInstance
}

func (p chunkedInstanceProvider) GetInstance(context.Context, log.Logger, map[string]string) (clientapi.Instance, error) {
	return p.i, nil
}

func TestQueryChunkedHandler(t *testing.T) {
	for _, tc := range []struct {
		name            string
		enabled, denied bool
		streamErr       error
		status          int
	}{
		{"enabled", true, false, nil, 200}, {"flag disabled", false, false, nil, 400}, {"denied", true, true, nil, 403}, {"error after frame", true, false, errors.New("stream interrupted"), 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			i := &chunkedInstance{enabled: tc.enabled, denied: tc.denied, streamErr: tc.streamErr}
			b := QueryAPIBuilder{instanceProvider: chunkedInstanceProvider{i: i}, reportStatus: func(context.Context, int) {}}
			var raw queryapi.QueryDataRequest
			require.NoError(t, json.Unmarshal([]byte(`{"from":"now-1h","to":"now","queries":[{"refId":"A","datasource":{"uid":"oracle","type":"grafana-oracle-datasource"}}]}`), &raw))
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/query", nil)
			b.queryChunkedDatasources(context.Background(), &raw, w, req, newRawResponderWrapper(context.Background(), w, nil, nil), log.New("test"))
			require.Equal(t, tc.status, w.Code)
			require.Equal(t, tc.enabled && !tc.denied, i.called)
			if tc.status == 200 {
				require.Equal(t, "text/jsonl", w.Header().Get("Content-Type"))
				require.True(t, w.Flushed)
			}
			if tc.streamErr != nil {
				require.Contains(t, w.Body.String(), `"error":"stream interrupted"`)
			}
		})
	}
}

func TestValidateChunkedQuery(t *testing.T) {
	for _, body := range []string{`{"queries":[]}`, `{"queries":[{"refId":"A"}]}`, `{"queries":[{"refId":"A","datasource":{"uid":"__expr__","type":"__expr__"}}]}`, `{"queries":[{"refId":"A","datasource":{"uid":"one","type":"oracle"}},{"refId":"B","datasource":{"uid":"two","type":"oracle"}}]}`, `{"queries":[{"refId":"A","datasource":{"uid":"one","type":"oracle"}},{"refId":"A","datasource":{"uid":"one","type":"oracle"}}]}`} {
		var raw dataapi.QueryDataRequest
		require.NoError(t, json.Unmarshal([]byte(body), &raw))
		_, err := validateChunkedQuery(raw)
		require.Error(t, err)
	}
}
