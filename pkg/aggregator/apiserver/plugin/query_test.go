package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	datav0alpha1 "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/plugin/fakes"
)

func TestQueryDataHandler(t *testing.T) {
	dps := v0alpha1.DataPlaneService{
		Spec: v0alpha1.DataPlaneServiceSpec{
			PluginID: "testds",
			Group:    "testds.example.com",
			Version:  "v1",
			Services: []v0alpha1.Service{
				{
					Type: v0alpha1.QueryServiceType,
				},
			},
		},
	}

	pluginContext := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			ID: 1,
		},
	}
	contextProvider := &fakes.FakePluginContextProvider{
		PluginContext: pluginContext,
	}

	res := &backend.QueryDataResponse{
		Responses: map[string]backend.DataResponse{
			"A": {
				Frames: []*data.Frame{
					{
						Name: "test-frame",
					},
				},
			},
		},
	}

	pc := &fakes.FakePluginClient{
		QueryDataHandlerFunc: newfakeQueryDataHandler(res, nil),
	}

	delegate := fakes.NewFakeHTTPHandler(http.StatusNotFound, []byte(`Not Found`))
	handler := NewPluginHandler(pc, dps, contextProvider, delegate)

	qdr := datav0alpha1.QueryDataRequest{
		TimeRange: datav0alpha1.TimeRange{},
		Queries: []datav0alpha1.DataQuery{{
			CommonQueryProperties: datav0alpha1.CommonQueryProperties{
				RefID:            "1",
				ResultAssertions: &datav0alpha1.ResultAssertions{},
				TimeRange:        &datav0alpha1.TimeRange{},
				Datasource: &datav0alpha1.DataSourceRef{
					Type:       "testds",
					UID:        "123",
					APIVersion: "v1",
				},
				DatasourceID:  0,
				QueryType:     "",
				MaxDataPoints: 0,
				IntervalMS:    0,
				Hide:          false,
			},
		}},
		Debug: false,
	}

	t.Run("should return query response", func(t *testing.T) {
		buf := bytes.NewBuffer(nil)
		assert.NoError(t, json.NewEncoder(buf).Encode(qdr))

		req, err := http.NewRequest("POST", "/apis/testds.example.com/v1/namespaces/default/datasources/123/query", buf)
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		res := &v0alpha1.QueryDataResponse{
			TypeMeta: metav1.TypeMeta{
				APIVersion: "aggregation.grafana.com/v0alpha1",
				Kind:       "QueryDataResponse",
			},
			QueryDataResponse: *res,
		}
		resBuf := bytes.NewBuffer(nil)
		assert.NoError(t, json.NewEncoder(resBuf).Encode(res))
		expected, err := json.MarshalIndent(res, "", "  ")
		require.NoError(t, err)
		assert.Equal(t, string(expected), rr.Body.String())
	})

	t.Run("should return type error", func(t *testing.T) {
		qdr.Queries[0].Datasource.Type = "wrongds"
		buf := bytes.NewBuffer(nil)
		assert.NoError(t, json.NewEncoder(buf).Encode(qdr))

		req, err := http.NewRequest("POST", "/apis/testds.example.com/v1/namespaces/default/datasources/123/query", buf)
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		res := &metav1.Status{
			TypeMeta: metav1.TypeMeta{
				APIVersion: "v1",
				Kind:       "Status",
			},
			Status:  metav1.StatusFailure,
			Code:    http.StatusInternalServerError,
			Message: "invalid datasource type",
		}
		resBuf := bytes.NewBuffer(nil)
		assert.NoError(t, json.NewEncoder(resBuf).Encode(res))
		expected, err := json.MarshalIndent(res, "", "  ")
		require.NoError(t, err)
		assert.Equal(t, string(expected), rr.Body.String())
	})

	t.Run("should return UID error", func(t *testing.T) {
		qdr.Queries[0].Datasource.Type = "testds"
		buf := bytes.NewBuffer(nil)
		assert.NoError(t, json.NewEncoder(buf).Encode(qdr))

		req, err := http.NewRequest("POST", "/apis/testds.example.com/v1/namespaces/default/datasources/abc/query", buf)
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		res := &metav1.Status{
			TypeMeta: metav1.TypeMeta{
				APIVersion: "v1",
				Kind:       "Status",
			},
			Status:  metav1.StatusFailure,
			Code:    http.StatusInternalServerError,
			Message: "invalid datasource UID",
		}
		resBuf := bytes.NewBuffer(nil)
		assert.NoError(t, json.NewEncoder(resBuf).Encode(res))
		expected, err := json.MarshalIndent(res, "", "  ")
		require.NoError(t, err)
		assert.Equal(t, string(expected), rr.Body.String())
	})

	t.Run("should return delegate response if group does not match", func(t *testing.T) {
		req, err := http.NewRequest("POST", "/apis/wrongds.example.com/v1/namespaces/default/datasources/abc/query", bytes.NewBuffer(nil))
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		assert.Equal(t, "Not Found", rr.Body.String())
	})
}

func newfakeQueryDataHandler(res *backend.QueryDataResponse, err error) backend.QueryDataHandlerFunc {
	return func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
		return res, err
	}
}
