package clientapi

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
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
	StackID                      uint32
	FeatureToggles               featuremgmt.FeatureToggles
	FullConfig                   map[string]map[string]string // configuration file settings
	Options                      map[string]string            // additional settings related to an instance as set by grafana
	SQLExpressionCellLimit       int64
	SQLExpressionOutputCellLimit int64
	SQLExpressionTimeout         time.Duration
	ExpressionsEnabled           bool
}

type DataSourceClientSupplier interface {
	// Get a client for a given datasource
	GetDataSourceClient(ctx context.Context, ref data.DataSourceRef, headers map[string]string, instanceConfig InstanceConfigurationSettings) (QueryDataClient, error)
	// fetch information on the grafana instance (e.g. feature toggles)
	GetInstanceConfigurationSettings(ctx context.Context) (InstanceConfigurationSettings, error)
}
