package sqlstore

/*
This exists as part of the intent-api labeled projects.
More can be seen at https://github.com/grafana/grafana/issues/44570.

This is highly experimental.

Until this comment is removed, if you are wondering if you should use things in here to access SQL, the answer is no.

*/

//var noBuild = datasource.DataSource{}

// var SchemaStoreProvidersSet wire.ProviderSet = wire.NewSet(
// 	ProviderDataSourceSchemaStore,
// 	wire.Bind(new(datasource.Store), new(*storeDS)),
// )

// func ProviderDataSourceSchemaStore() *storeDS {
// 	return &storeDS{}
// 	// return an instantiate instance of storeDS with injected state it may need
// }

// type storeDS struct{}

// func (s storeDS) Get(uid string) (datasource.DataSource, error) {
// 	return datasource.DataSource{}, nil
// }

// func (s storeDS) Upsert(uid string, ds datasource.DataSource) error {
// 	return nil
// }

// func (s storeDS) Delete(uid string) error {
// 	return nil
// }
