package sqlstore

import (
	"context"
	"errors"
	"strconv"

	"github.com/google/wire"
	"github.com/grafana/grafana/internal/components"
	"github.com/grafana/grafana/internal/components/datasource"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
)

/*
This exists as part of the intent-api labeled projects.
More can be seen at https://github.com/grafana/grafana/issues/44570.

This is highly experimental.

Until this comment is removed, if you are wondering if you should use things in here to access SQL, the answer is no.

*/

var SchemaStoreProvidersSet wire.ProviderSet = wire.NewSet(
	ProvideDataSourceSchemaStore,
	wire.Bind(new(components.Store), new(*storeDS)),
)

func ProvideDataSourceSchemaStore(ss *SQLStore) *storeDS {
	return &storeDS{
		ss: ss,
	}
	// return an instantiate instance of storeDS with injected state it may need
}

type storeDS struct {
	ss *SQLStore
}

func (s storeDS) Get(ctx context.Context, name types.NamespacedName, into runtime.Object) error {
	cmd := &models.GetDataSourceQuery{
		OrgId: 1, // Hardcode for now
		Name:  name.Name,
	}

	if err := s.ss.GetDataSource(ctx, cmd); err != nil {
		return err
	}

	if err := s.oldToNew(cmd.Result, into); err != nil {
		return err
	}

	return nil
}

func (s storeDS) Insert(ctx context.Context, obj runtime.Object) error {
	ds, ok := obj.(*datasource.Datasource)
	if !ok {
		return errors.New("error: expected object to be a datasource")
	}

	cmd := &models.AddDataSourceCommand{
		Name:              ds.Name,
		Type:              ds.Spec.Type,
		Access:            models.DsAccess(ds.Spec.Access),
		Url:               ds.Spec.Url,
		Password:          ds.Spec.Password,
		Database:          ds.Spec.Database,
		User:              ds.Spec.User,
		BasicAuth:         ds.Spec.BasicAuth,
		BasicAuthUser:     ds.Spec.BasicAuthUser,
		BasicAuthPassword: ds.Spec.BasicAuthPassword,
		WithCredentials:   ds.Spec.WithCredentials,
		IsDefault:         ds.Spec.IsDefault,
		JsonData:          s.parseJSONData(ds),
		// SecureJsonData: TODO,
		Uid:   string(ds.UID),
		OrgId: 1, // hardcode for now, TODO
	}
	return s.ss.AddDataSource(ctx, cmd)
}

func (s storeDS) Update(ctx context.Context, obj runtime.Object) error {
	ds, ok := obj.(*datasource.Datasource)
	if !ok {
		return errors.New("error: expected object to be a datasource")
	}

	rv, err := strconv.Atoi(ds.ResourceVersion)
	if err != nil {
		return err
	}

	cmd := &models.UpdateDataSourceCommand{
		Name:              ds.Name,
		Type:              ds.Spec.Type,
		Access:            models.DsAccess(ds.Spec.Access),
		Url:               ds.Spec.Url,
		Password:          ds.Spec.Password,
		Database:          ds.Spec.Database,
		User:              ds.Spec.User,
		BasicAuth:         ds.Spec.BasicAuth,
		BasicAuthUser:     ds.Spec.BasicAuthUser,
		BasicAuthPassword: ds.Spec.BasicAuthPassword,
		WithCredentials:   ds.Spec.WithCredentials,
		IsDefault:         ds.Spec.IsDefault,
		JsonData:          s.parseJSONData(ds),
		// SecureJsonData: TODO,
		Uid:     string(ds.UID),
		OrgId:   1, // hardcode for now, TODO
		Version: rv,
		// TODO: sets updated timestamp
	}
	// Note: SQL version returns the modified ds with the version bumped
	// and timestamps set
	return s.ss.UpdateDataSourceByUID(ctx, cmd)
}

func (s storeDS) Delete(ctx context.Context, name types.NamespacedName) error {
	return s.ss.DeleteDataSource(ctx, &models.DeleteDataSourceCommand{
		Name:  name.Name,
		OrgID: 1, // hardcode for now, TODO
	})
}

// oldToNew doesn't need to be method, but keeps things bundled
func (s storeDS) oldToNew(ds *models.DataSource, result runtime.Object) error {
	out, ok := result.(*datasource.Datasource)
	if !ok {
		return errors.New("error: expected object to be a datasource")
	}

	jd, err := ds.JsonData.MarshalJSON()
	if err != nil {
		jd = []byte{}
		s.ss.log.Warn("error marshaling datasource JSON data", err)
	}

	out.UID = types.UID(ds.Uid)
	out.Name = ds.Name
	out.ResourceVersion = strconv.Itoa(ds.Version)
	out.Spec = datasource.DatasourceSpec{
		Type:              ds.Type,
		Access:            string(ds.Access),
		Url:               ds.Url,
		Password:          ds.Password,
		Database:          ds.Database,
		User:              ds.User,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          string(jd),
	}

	return nil
}

func (s storeDS) parseJSONData(ds *datasource.Datasource) *simplejson.Json {
	jd := simplejson.New()

	if d := ds.Spec.JsonData; d != "" {
		if err := jd.UnmarshalJSON([]byte(ds.Spec.JsonData)); err != nil {
			s.ss.log.Warn(
				"error unmarshaling datasource JSON data",
				"error", err,
			)
		}
	}

	return jd
}
