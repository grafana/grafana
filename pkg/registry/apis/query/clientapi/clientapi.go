package clientapi

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type Response struct {
	QDR     *backend.QueryDataResponse
	Headers http.Header
}

type QueryDataClient interface {
	QueryData(ctx context.Context, req data.QueryDataRequest) (*backend.QueryDataResponse, error)
}

type InstanceConfigurationSettings struct {
	FeatureToggles               featuremgmt.FeatureToggles
	SQLExpressionCellLimit       int64
	SQLExpressionOutputCellLimit int64
	SQLExpressionTimeout         time.Duration
	ExpressionsEnabled           bool
}

type Instance interface {
	GetDataSourceClient(ctx context.Context, ref data.DataSourceRef) (QueryDataClient, error)
	// fetch information on the grafana instance (e.g. feature toggles)
	GetSettings() InstanceConfigurationSettings
	GetLogger(parent log.Logger) log.Logger
	ReportMetrics() // some metrics are only reported at the end
}

type InstanceProvider interface {
	GetInstance(ctx context.Context, headers map[string]string) (Instance, error)
}
