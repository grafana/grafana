package sqlstore

import (
	"context"

	"github.com/google/wire"
	"github.com/grafana/grafana/internal/components/datasource"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

/*
This exists as part of the intent-api labeled projects.
More can be seen at https://github.com/grafana/grafana/issues/44570.

This is highly experimental.

Until this comment is removed, if you are wondering if you should use things in here to access SQL, the answer is no.

*/

var SchemaStoreProvidersSet wire.ProviderSet = wire.NewSet(
	ProvideDataSourceSchemaStore,
	wire.Bind(new(datasource.Store), new(*storeDS)),
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

func (s storeDS) Get(ctx context.Context, uid string) (datasource.DataSource, error) {
	cmd := &models.GetDataSourceQuery{
		OrgId: 1, // Hardcode for now
		Uid:   uid,
	}

	if err := s.ss.GetDataSource(ctx, cmd); err != nil {
		return datasource.DataSource{}, err
	}

	return s.oldToNew(cmd.Result), nil
}

func (s storeDS) Insert(ctx context.Context, ds datasource.DataSource) error {
	cmd := &models.AddDataSourceCommand{
		Name:              ds.Name,
		Type:              ds.Type,
		Access:            models.DsAccess(ds.Access),
		Url:               ds.Url,
		Password:          ds.Password,
		Database:          ds.Database,
		User:              ds.User,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          simplejson.NewFromAny(ds.JsonData),
		// SecureJsonData: TODO,
		Uid:   ds.UID,
		OrgId: 1, // hardcode for now, TODO
	}
	return s.ss.AddDataSource(ctx, cmd)
}

func (s storeDS) Update(ctx context.Context, ds datasource.DataSource) error {
	cmd := &models.UpdateDataSourceCommand{
		Name:              ds.Name,
		Type:              ds.Type,
		Access:            models.DsAccess(ds.Access),
		Url:               ds.Url,
		Password:          ds.Password,
		Database:          ds.Database,
		User:              ds.User,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          simplejson.NewFromAny(ds.JsonData),
		// SecureJsonData: TODO,
		Uid:     ds.UID,
		OrgId:   1, // hardcode for now, TODO
		Version: ds.Version,
		// TODO: sets updated timestamp
	}
	// Note: SQL version returns the modified ds with the version bumped
	// and timestamps set
	return s.ss.UpdateDataSourceByUID(ctx, cmd)
}

func (s storeDS) Delete(ctx context.Context, uid string) error {
	return s.ss.DeleteDataSource(ctx, &models.DeleteDataSourceCommand{
		UID:   uid,
		OrgID: 1, // hardcode for now, TODO
	})
}

// oldToNew doesn't need to be method, but keeps things bundled
func (s storeDS) oldToNew(ds *models.DataSource) datasource.DataSource {
	jdMap := ds.JsonData.MustMap()
	return datasource.DataSource{
		Name:              ds.Name,
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
		JsonData:          jdMap,
		// SecureJsonData: TODO,
		UID:     ds.Uid,
		Version: ds.Version,
		// Note: Not mapped is created / updated time stamps
	}
}
