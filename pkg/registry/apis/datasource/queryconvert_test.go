package datasource

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestSubQueryConvertConnect(t *testing.T) {
	originReq := `{"from":"","to":"","queries":[{"refId":"A","datasource":{"type":"","uid":"dsuid"},"rawSql":"SELECT * FROM table"}]}`
	converted := `{"refId":"A","datasource":{"type":"","uid":"dsuid"},"SQL":"SELECT * FROM table"}`
	convertedReq := `{"from":"","to":"","queries":[` + converted + `]}`

	sqr := queryConvertREST{
		client: mockConvertClient{
			t:             t,
			expectedInput: backend.RawObject{Raw: []byte(originReq), ContentType: "application/json"},
			convertObject: backend.RawObject{Raw: []byte(converted), ContentType: "application/json"},
		},
		contextProvider: mockContextProvider{},
	}
	rr := httptest.NewRecorder()
	mr := &mockResponderConvert{
		writer: rr,
	}
	handler, err := sqr.Connect(context.Background(), "name", nil, mr)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/", bytes.NewReader([]byte(originReq)))
	req.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	require.Contains(t, rr.Body.String(), convertedReq)
}

type mockConvertClient struct {
	t             *testing.T
	expectedInput backend.RawObject
	convertObject backend.RawObject
}

func (m mockConvertClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, nil
}

func (m mockConvertClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return nil
}

func (m mockConvertClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, nil
}

func (m mockConvertClient) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	require.Equal(m.t, string(m.expectedInput.Raw), string(req.Objects[0].Raw))
	return &backend.ConversionResponse{
		Objects: []backend.RawObject{m.convertObject},
	}, nil
}

type mockResponderConvert struct {
	writer http.ResponseWriter
}

// Object writes the provided object to the response. Invoking this method multiple times is undefined.
func (m mockResponderConvert) Object(statusCode int, obj runtime.Object) {
	m.writer.WriteHeader(statusCode)
	err := json.NewEncoder(m.writer).Encode(obj)
	if err != nil {
		panic(err)
	}
}

// Error writes the provided error to the response. This method may only be invoked once.
func (m mockResponderConvert) Error(err error) {
	m.writer.WriteHeader(http.StatusInternalServerError)
	errStr := err.Error()
	_, err = m.writer.Write([]byte(errStr))
	if err != nil {
		panic(err)
	}
}
