package clientapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type Response struct {
	QDR     *backend.QueryDataResponse
	Headers http.Header
}

type QueryDataClient interface {
	QueryData(ctx context.Context, req data.QueryDataRequest) (*backend.QueryDataResponse, error)
	// QueryDataHttpResponse returns a response whose body is a JSON encoded QueryDataResponse.
	// Implementations may stream the body from the datasource without decoding it.
	// The caller must close the response body.
	QueryDataHttpResponse(ctx context.Context, req data.QueryDataRequest) (*http.Response, error)
}

// NewQDRHttpResponse encodes an already decoded QueryDataResponse as an http.Response,
// for QueryDataClient implementations that cannot forward the original bytes.
func NewQDRHttpResponse(statusCode int, qdr *backend.QueryDataResponse) (*http.Response, error) {
	body, err := json.Marshal(qdr)
	if err != nil {
		return nil, err
	}
	header := http.Header{}
	header.Set("Content-Type", "application/json")
	header.Set("Content-Length", strconv.Itoa(len(body)))
	return &http.Response{
		Status:        http.StatusText(statusCode),
		StatusCode:    statusCode,
		Header:        header,
		Body:          io.NopCloser(bytes.NewReader(body)),
		ContentLength: int64(len(body)),
	}, nil
}

type InstanceConfigurationSettings struct {
	FeatureToggles                featuremgmt.FeatureToggles
	SQLExpressionCellLimit        int64
	SQLExpressionOutputCellLimit  int64
	SQLExpressionQueryLengthLimit int64
	SQLExpressionTimeout          time.Duration
	ExpressionsEnabled            bool
}

type Instance interface {
	GetDataSourceClient(ctx context.Context, ref data.DataSourceRef) (QueryDataClient, error)
	// fetch information on the grafana instance (e.g. feature toggles)
	GetSettings() InstanceConfigurationSettings
	GetLogger() log.Logger // returns the instance's logger. this logs instance-specific data too
	ReportMetrics()        // some metrics are only reported at the end
}

type InstanceProvider interface {
	GetInstance(ctx context.Context, logger log.Logger, headers map[string]string) (Instance, error)
	GetMode() string
}
