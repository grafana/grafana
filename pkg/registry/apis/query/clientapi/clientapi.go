package clientapi

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type QueryDataClient interface {
	QueryData(ctx context.Context, req data.QueryDataRequest) (*backend.QueryDataResponse, error)
}

type InstanceConfigurationSettings struct {
	StackID        uint32
	FeatureToggles featuremgmt.FeatureToggles
	FullConfig     map[string]map[string]string // configuration file settings
	Options        map[string]string            // additional settings related to an instance as set by grafana
}

type DataSourceClientSupplier interface {
	// Get a client for a given datasource
	GetDataSourceClient(ctx context.Context, ref data.DataSourceRef, headers map[string]string, instanceConfig InstanceConfigurationSettings) (QueryDataClient, error)
	// fetch information on the grafana instance (e.g. feature toggles)
	GetInstanceConfigurationSettings(ctx context.Context) (InstanceConfigurationSettings, error)
}
