package queryconvert

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage              = (*queryConvertStorage)(nil)
	_ rest.Scoper               = (*queryConvertStorage)(nil)
	_ rest.SingularNameProvider = (*queryConvertStorage)(nil)
	_ rest.Creater              = (*queryConvertStorage)(nil)
)

// PluginContext requires adding system settings (feature flags, etc) to the datasource config
type PluginContextWrapper interface {
	PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error)
}

type queryConvertStorage struct {
	resourceInfo    *utils.ResourceInfo
	tableConverter  rest.TableConvertor
	client          PluginClientConversion
	contextProvider PluginContextWrapper
}

type PluginClientConversion interface {
	backend.ConversionHandler
}

func RegisterQueryTypes(client PluginClientConversion, storage map[string]rest.Storage, contextProvider PluginContextWrapper) error {
	resourceInfo := query.QueryConvertDefinitionResourceInfo
	store := &queryConvertStorage{
		resourceInfo:    &resourceInfo,
		tableConverter:  rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		client:          client,
		contextProvider: contextProvider,
	}
	storage[resourceInfo.StoragePath()] = store
	return nil
}

func (s *queryConvertStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *queryConvertStorage) Destroy() {}

func (s *queryConvertStorage) NamespaceScoped() bool {
	return true
}

func (s *queryConvertStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *queryConvertStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *queryConvertStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	dqr, ok := obj.(*query.QueryDataRequest)
	if !ok {
		return nil, fmt.Errorf("unexpected object type: %T", obj)
	}

	ds := dqr.Queries[0].Datasource
	pluginCtx, err := s.contextProvider.PluginContextForDataSource(ctx, &backend.DataSourceInstanceSettings{
		Type:       ds.Type,
		UID:        ds.UID,
		APIVersion: ds.APIVersion,
	})
	if err != nil {
		return nil, err
	}

	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	raw, err := json.Marshal(dqr)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}
	convertRequest := &backend.ConversionRequest{
		PluginContext: pluginCtx,
		Objects: []backend.RawObject{
			{
				Raw:         raw,
				ContentType: "application/json",
			},
		},
	}

	convertResponse, err := s.client.ConvertObjects(ctx, convertRequest)
	if err != nil {
		if convertResponse != nil && convertResponse.Result != nil {
			return nil, fmt.Errorf("conversion failed. Err: %w. Result: %s", err, convertResponse.Result.Message)
		}
		return nil, err
	}

	qr := &query.QueryDataRequest{}
	for _, obj := range convertResponse.Objects {
		if obj.ContentType != "application/json" {
			return nil, fmt.Errorf("unexpected content type: %s", obj.ContentType)
		}
		q := &data.DataQuery{}
		err = json.Unmarshal(obj.Raw, q)
		if err != nil {
			return nil, fmt.Errorf("unmarshal: %w", err)
		}
		qr.Queries = append(qr.Queries, *q)
	}

	return qr, nil
}
