package datasource

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/errors"
	cuejson "cuelang.org/go/encoding/json"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

// This provides access to settings saved in the database.
// Authorization checks will happen within each function, and the user in ctx will
// limit which namespace/tenant/org we are talking to
type PluginDatasourceProvider interface {
	// Get gets a specific datasource (that the user in context can see)
	GetConnection(ctx context.Context, uid string) (*v0alpha1.DataSourceConnection, error)

	// List lists all data sources the user in context can see
	ListConnections(ctx context.Context) (*v0alpha1.DataSourceConnectionList, error)

	// Get a single datasurce
	GetDataSource(ctx context.Context, uid string) (*v0alpha1.GenericDataSource, error)

	// List all datasources
	ListDataSource(ctx context.Context) (*v0alpha1.GenericDataSourceList, error)

	// Create a data source
	CreateDataSource(ctx context.Context, ds *v0alpha1.GenericDataSource) (*v0alpha1.GenericDataSource, error)

	// Update a data source
	UpdateDataSource(ctx context.Context, ds *v0alpha1.GenericDataSource) (*v0alpha1.GenericDataSource, error)

	// Delete datasurce
	Delete(ctx context.Context, uid string) error

	// Return settings (decrypted!) for a specific plugin
	// This will require "query" permission for the user in context
	GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error)
}

type ScopedPluginDatasourceProvider interface {
	GetDatasourceProvider(pluginJson plugins.JSONData) PluginDatasourceProvider
}

// PluginContext requires adding system settings (feature flags, etc) to the datasource config
type PluginContextWrapper interface {
	PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error)
}

func ProvideDefaultPluginConfigs(
	dsService datasources.DataSourceService,
	dsCache datasources.CacheService,
	contextProvider *plugincontext.Provider) ScopedPluginDatasourceProvider {
	return &cachingDatasourceProvider{
		dsService:       dsService,
		dsCache:         dsCache,
		contextProvider: contextProvider,
		converter: &converter{
			mapper: types.OrgNamespaceFormatter, // TODO -- from cfg!!!
		},
	}
}

type cachingDatasourceProvider struct {
	dsService       datasources.DataSourceService
	dsCache         datasources.CacheService
	contextProvider *plugincontext.Provider
	converter       *converter
}

func (q *cachingDatasourceProvider) GetDatasourceProvider(pluginJson plugins.JSONData) PluginDatasourceProvider {
	group, _ := plugins.GetDatasourceGroupNameFromPluginID(pluginJson.ID)
	return &scopedDatasourceProvider{
		plugin:          pluginJson,
		dsService:       q.dsService,
		dsCache:         q.dsCache,
		contextProvider: q.contextProvider,
		converter: &converter{
			mapper: q.converter.mapper,
			dstype: pluginJson.ID,
			group:  group,
		},
	}
}

type scopedDatasourceProvider struct {
	plugin          plugins.JSONData
	dsService       datasources.DataSourceService
	dsCache         datasources.CacheService
	contextProvider *plugincontext.Provider
	converter       *converter
}

var (
	_ PluginDatasourceProvider       = (*scopedDatasourceProvider)(nil)
	_ ScopedPluginDatasourceProvider = (*cachingDatasourceProvider)(nil)
)

func (q *scopedDatasourceProvider) GetConnection(ctx context.Context, uid string) (*v0alpha1.DataSourceConnection, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := q.dsCache.GetDatasourceByUID(ctx, uid, user, false)
	if err != nil {
		return nil, err
	}
	return q.converter.asConnection(ds)
}

func (q *scopedDatasourceProvider) ListConnections(ctx context.Context) (*v0alpha1.DataSourceConnectionList, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dss, err := q.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
		OrgID:    info.OrgID,
		Type:     q.plugin.ID,
		AliasIDs: q.plugin.AliasIDs,
	})
	if err != nil {
		return nil, err
	}
	result := &v0alpha1.DataSourceConnectionList{
		Items: []v0alpha1.DataSourceConnection{},
	}
	for _, ds := range dss {
		v, _ := q.converter.asConnection(ds)
		result.Items = append(result.Items, *v)
	}
	return result, nil
}

func (q *scopedDatasourceProvider) GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	if q.contextProvider == nil {
		return nil, fmt.Errorf("missing contextProvider")
	}
	return q.contextProvider.GetDataSourceInstanceSettings(ctx, uid)
}

// CreateDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) CreateDataSource(ctx context.Context, ds *v0alpha1.GenericDataSource) (*v0alpha1.GenericDataSource, error) {
	cmd, err := q.converter.toAddCommand(ds)
	if err != nil {
		return nil, err
	}
	out, err := q.dsService.AddDataSource(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return q.converter.asGenericDataSource(out)
}

// UpdateDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) UpdateDataSource(ctx context.Context, ds *v0alpha1.GenericDataSource) (*v0alpha1.GenericDataSource, error) {
	errs := ValidateDatasourceSpec(ds)
	if len(errs) > 0 {
		errStrings := []string{}
		for _, e := range errs {
			errStrings = append(errStrings, e.Error())
		}
		return nil, fmt.Errorf("validate errors: %s", strings.Join(errStrings, ", "))
	}

	// We don't have, or want, a numeric ID in the new world.
	// Instead, we have a k8s name, which maps to UID.
	// Existing code needs ID though, so fetch it from UID and orgID.
	query := &datasources.GetDataSourceQuery{
		UID:   ds.Name,
		OrgID: 1,
	}
	existingDS, err := q.dsService.GetDataSource(ctx, query)
	if err != nil {
		return nil, err
	}
	if existingDS == nil || q.plugin.ID != existingDS.Type {
		return nil, fmt.Errorf("not found")
	}

	cmd, err := q.converter.toUpdateCommand(ds)
	if err != nil {
		return nil, err
	}
	cmd.ID = existingDS.ID
	out, err := q.dsService.UpdateDataSource(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return q.converter.asGenericDataSource(out)
}

// Delete implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) Delete(ctx context.Context, uid string) error {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	ds, err := q.dsCache.GetDatasourceByUID(ctx, uid, user, false)
	if err != nil {
		return err
	}
	if ds == nil || q.plugin.ID != ds.Type {
		return fmt.Errorf("not found")
	}
	return q.dsService.DeleteDataSource(ctx, &datasources.DeleteDataSourceCommand{
		ID:    ds.ID,
		UID:   ds.UID,
		OrgID: ds.OrgID,
		Name:  ds.Name,
	})
}

// GetDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) GetDataSource(ctx context.Context, uid string) (*v0alpha1.GenericDataSource, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := q.dsCache.GetDatasourceByUID(ctx, uid, user, false)
	if err != nil {
		return nil, err
	}
	if ds == nil || q.plugin.ID != ds.Type {
		return nil, fmt.Errorf("not found")
	}
	return q.converter.asGenericDataSource(ds)
}

// ListDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) ListDataSource(ctx context.Context) (*v0alpha1.GenericDataSourceList, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dss, err := q.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
		OrgID:    info.OrgID,
		Type:     q.plugin.ID,
		AliasIDs: q.plugin.AliasIDs,
	})
	if err != nil {
		return nil, err
	}
	result := &v0alpha1.GenericDataSourceList{
		Items: []v0alpha1.GenericDataSource{},
	}
	for _, ds := range dss {
		v, _ := q.converter.asGenericDataSource(ds)
		result.Items = append(result.Items, *v)
	}
	return result, nil
}

//go:embed datasource_kind.cue
var schemaSource string
var (
	compiledSchema cue.Value
	getSchemaOnce  sync.Once
)

func getCueSchema() cue.Value {
	getSchemaOnce.Do(func() {
		cueCtx := cuecontext.New()
		compiledSchema = cueCtx.CompileString(schemaSource).LookupPath(
			cue.ParsePath("lineage.schemas[0].schema.spec"),
		)
		if compiledSchema.Err() != nil {
			backend.Logger.Error("Error compiling cue schema", compiledSchema.Err().Error())
			backend.Logger.Info(schemaSource)
		}
	})

	return compiledSchema
}

func ValidateDatasourceSpec(obj *v0alpha1.GenericDataSource) field.ErrorList {
	data, err := json.Marshal(obj.Spec)
	if err != nil {
		return field.ErrorList{
			field.Invalid(field.NewPath("spec"), field.OmitValueType{}, err.Error()),
		}
	}
	backend.Logger.Info(fmt.Sprintf("json obj: %s", string(data)))

	errs := field.ErrorList{}
	if err := cuejson.Validate(data, getCueSchema()); err != nil {
		for _, e := range errors.Errors(err) {
			format, args := e.Msg()
			errs = append(errs, field.Invalid(
				field.NewPath(strings.Join(e.Path(), "->")),
				field.OmitValueType{},
				fmt.Sprintf(format, args...),
			))
		}
	}

	return errs
}
