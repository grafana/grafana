package client

import (
	"context"
	"errors"
	"net/http"

	datasourcev0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	queryv0alpha1 "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"k8s.io/client-go/kubernetes"
)

// DataSourceConnectionClient can get information about data source connections.
//
//go:generate mockery --name DataSourceConnectionClient --structname MockDataSourceConnectionClient --inpackage --filename=client_mock.go --with-expecter
type DataSourceConnectionClient interface {
	Get(ctx context.Context, group, version, name string) (*queryv0alpha1.DataSourceConnection, error)
}

func ProvideDataSourceConnectionClientFactory(
	restConfigProvider apiserver.RestConfigProvider,
) DataSourceConnectionClientFactory {
	return func(configProvider apiserver.RestConfigProvider) DataSourceConnectionClient {
		return &dataSourceConnectionClient{
			configProvider: configProvider,
		}
	}
}

type DataSourceConnectionClientFactory func(configProvider apiserver.RestConfigProvider) DataSourceConnectionClient

type dataSourceConnectionClient struct {
	configProvider apiserver.RestConfigProvider
}

func (dc *dataSourceConnectionClient) Get(ctx context.Context, group, version, name string) (*queryv0alpha1.DataSourceConnection, error) {
	cfg, err := dc.configProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, err
	}

	client, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	if version == "" {
		version = "v0alpha1"
	}

	result := client.RESTClient().Get().
		Prefix("apis", group, version).
		Namespace("default"). // TODO do something about namespace
		Resource("datasources").
		Name(name).
		Do(ctx)

	if err = result.Error(); err != nil {
		return nil, err
	}

	var statusCode int

	result = result.StatusCode(&statusCode)
	if statusCode == http.StatusNotFound {
		return nil, errors.New("not found")
	}

	fullDS := datasourcev0alpha1.DataSource{}
	err = result.Into(&fullDS)
	if err != nil {
		return nil, err
	}

	dsConnection := &queryv0alpha1.DataSourceConnection{
		Title: fullDS.Spec.Title(),
		Datasource: queryv0alpha1.DataSourceConnectionRef{
			Group:   fullDS.GroupVersionKind().Group,
			Name:    fullDS.ObjectMeta.Name,
			Version: fullDS.GroupVersionKind().Version,
		},
	}

	return dsConnection, nil
}
