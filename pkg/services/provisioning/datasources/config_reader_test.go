package datasources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger log.Logger = log.New("fake.log")

	twoDatasourcesConfig            = "testdata/two-datasources"
	twoDatasourcesConfigPurgeOthers = "testdata/insert-two-delete-two"
	deleteOneDatasource             = "testdata/delete-one"
	recreateOneDatasource           = "testdata/recreate-one"
	doubleDatasourcesConfig         = "testdata/double-default"
	allProperties                   = "testdata/all-properties"
	versionZero                     = "testdata/version-0"
	brokenYaml                      = "testdata/broken-yaml"
	multipleOrgsWithDefault         = "testdata/multiple-org-default"
	withoutDefaults                 = "testdata/appliedDefaults"
	invalidAccess                   = "testdata/invalid-access"
	beforeAutoDeletion              = "testdata/before-auto-deletion"
	afterAutoDeletion               = "testdata/after-auto-deletion"

	oneDatasourceWithTwoCorrelations   = "testdata/one-datasource-two-correlations"
	correlationsDifferentOrganizations = "testdata/correlations-different-organizations"
)

func TestDatasourceAsConfig(t *testing.T) {
	t.Run("when some values missing should apply default on insert", func(t *testing.T) {
		store := &spyStore{}
		orgFake := &orgtest.FakeOrgService{ExpectedOrg: &org.Org{ID: 1}}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		err := dc.applyChanges(context.Background(), withoutDefaults)
		if err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(store.inserted), 1)
		require.Equal(t, store.inserted[0].OrgID, int64(1))
		require.Equal(t, store.inserted[0].Access, datasources.DsAccess("proxy"))
		require.Equal(t, store.inserted[0].Name, "My datasource name")
		require.Equal(t, store.inserted[0].UID, "P2AD1F727255C56BA")
	})

	t.Run("when some values missing should not change UID when updates", func(t *testing.T) {
		store := &spyStore{
			items: []*datasources.DataSource{{Name: "My datasource name", OrgID: 1, ID: 1, UID: util.GenerateShortUID()}},
		}
		orgFake := &orgtest.FakeOrgService{}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		err := dc.applyChanges(context.Background(), withoutDefaults)
		if err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(store.deleted), 0)
		require.Equal(t, len(store.inserted), 0)
		require.Equal(t, len(store.updated), 1)
		require.Equal(t, "", store.updated[0].UID) // XORM will not update the field if its value is default
	})

	t.Run("no datasource in database", func(t *testing.T) {
		store := &spyStore{}
		orgFake := &orgtest.FakeOrgService{}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		err := dc.applyChanges(context.Background(), twoDatasourcesConfig)
		if err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(store.deleted), 0)
		require.Equal(t, len(store.inserted), 2)
		require.Equal(t, len(store.updated), 0)
	})

	t.Run("One datasource in database with same name should update one datasource", func(t *testing.T) {
		store := &spyStore{items: []*datasources.DataSource{{Name: "Graphite", OrgID: 1, ID: 1}}}
		orgFake := &orgtest.FakeOrgService{}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		err := dc.applyChanges(context.Background(), twoDatasourcesConfig)
		if err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(store.deleted), 0)
		require.Equal(t, len(store.inserted), 1)
		require.Equal(t, len(store.updated), 1)
	})

	t.Run("Two datasources with is_default should raise error", func(t *testing.T) {
		store := &spyStore{}
		orgFake := &orgtest.FakeOrgService{}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		err := dc.applyChanges(context.Background(), doubleDatasourcesConfig)
		require.Equal(t, err, ErrInvalidConfigToManyDefault)
	})

	t.Run("Multiple datasources in different organizations with isDefault in each organization should not raise error", func(t *testing.T) {
		store := &spyStore{}
		orgFake := &orgtest.FakeOrgService{}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		err := dc.applyChanges(context.Background(), multipleOrgsWithDefault)
		require.NoError(t, err)
		require.Equal(t, len(store.inserted), 4)
		require.True(t, store.inserted[0].IsDefault)
		require.Equal(t, store.inserted[0].OrgID, int64(1))
		require.True(t, store.inserted[2].IsDefault)
		require.Equal(t, store.inserted[2].OrgID, int64(2))
	})

	t.Run("Remove one datasource should have removed old datasource", func(t *testing.T) {
		store := &spyStore{items: []*datasources.DataSource{{Name: "old-data-source", OrgID: 1, UID: "old-data-source"}}}
		orgFake := &orgtest.FakeOrgService{}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		err := dc.applyChanges(context.Background(), deleteOneDatasource)
		if err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, 1, len(store.deleted))
		// should have set OrgID to 1
		require.Equal(t, store.deleted[0].OrgID, int64(1))
		require.Equal(t, 0, len(store.inserted))
		require.Equal(t, len(store.updated), 0)
	})

	t.Run("Two configured datasource and purge others", func(t *testing.T) {
		store := &spyStore{items: []*datasources.DataSource{{Name: "old-graphite", OrgID: 1, ID: 1}, {Name: "old-graphite3", OrgID: 1, ID: 2}}}
		orgFake := &orgtest.FakeOrgService{}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		err := dc.applyChanges(context.Background(), twoDatasourcesConfigPurgeOthers)
		if err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(store.deleted), 2)
		require.Equal(t, len(store.inserted), 2)
		require.Equal(t, len(store.updated), 0)
	})

	t.Run("Two configured datasource and purge others = false", func(t *testing.T) {
		store := &spyStore{items: []*datasources.DataSource{{Name: "Graphite", OrgID: 1, ID: 1}, {Name: "old-graphite2", OrgID: 1, ID: 2}}}
		orgFake := &orgtest.FakeOrgService{}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		err := dc.applyChanges(context.Background(), twoDatasourcesConfig)
		if err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(store.deleted), 0)
		require.Equal(t, len(store.inserted), 1)
		require.Equal(t, len(store.updated), 1)
	})

	t.Run("Delete data sources when removing them from provision files", func(t *testing.T) {
		store := &spyStore{}
		orgFake := &orgtest.FakeOrgService{}
		correlationsStore := &mockCorrelationsStore{}
		dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
		if err := dc.applyChanges(context.Background(), beforeAutoDeletion); err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(store.deleted), 0)
		require.Equal(t, len(store.inserted), 5)
		require.Equal(t, len(store.updated), 0)

		if err := dc.applyChanges(context.Background(), afterAutoDeletion); err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(store.deleted), 2)

		remainingDataSourceNames := make([]string, 3)

		for i, ds := range store.items {
			remainingDataSourceNames[i] = ds.Name
		}

		require.Contains(t, remainingDataSourceNames, "test_graphite_without_prune")
		require.Contains(t, remainingDataSourceNames, "test_prometheus_without_prune")
		require.Contains(t, remainingDataSourceNames, "test_graphite_with_prune")

		require.NotContains(t, remainingDataSourceNames, "testdata_with_prune")
		require.NotContains(t, remainingDataSourceNames, "test_prometheus_with_prune")
	})

	t.Run("broken yaml should return error", func(t *testing.T) {
		reader := &configReader{}
		_, err := reader.readConfig(context.Background(), brokenYaml)
		require.NotNil(t, err)
	})

	t.Run("invalid access should warn about invalid value and return 'proxy'", func(t *testing.T) {
		reader := &configReader{log: logger, orgService: &orgtest.FakeOrgService{}}
		configs, err := reader.readConfig(context.Background(), invalidAccess)
		require.NoError(t, err)
		require.Equal(t, configs[0].Datasources[0].Access, datasources.DS_ACCESS_PROXY)
	})

	t.Run("skip invalid directory", func(t *testing.T) {
		cfgProvider := &configReader{log: log.New("test logger"), orgService: &orgtest.FakeOrgService{}}
		cfg, err := cfgProvider.readConfig(context.Background(), "./invalid-directory")
		if err != nil {
			t.Fatalf("readConfig return an error %v", err)
		}

		require.Equal(t, len(cfg), 0)
	})

	t.Run("can read all properties from version 1", func(t *testing.T) {
		t.Setenv("TEST_VAR", "name")
		cfgProvider := &configReader{log: log.New("test logger"), orgService: &orgtest.FakeOrgService{}}
		cfg, err := cfgProvider.readConfig(context.Background(), allProperties)
		if err != nil {
			t.Fatalf("readConfig return an error %v", err)
		}

		require.Equal(t, len(cfg), 3)

		dsCfg := cfg[0]

		require.Equal(t, dsCfg.APIVersion, int64(1))

		validateDatasourceV1(t, dsCfg)
		validateDeleteDatasources(t, dsCfg)

		dsCount := 0
		delDsCount := 0

		for _, c := range cfg {
			dsCount += len(c.Datasources)
			delDsCount += len(c.DeleteDatasources)
		}

		require.Equal(t, dsCount, 2)
		require.Equal(t, delDsCount, 1)
	})

	t.Run("can read all properties from version 0", func(t *testing.T) {
		cfgProvider := &configReader{log: log.New("test logger"), orgService: &orgtest.FakeOrgService{}}
		cfg, err := cfgProvider.readConfig(context.Background(), versionZero)
		if err != nil {
			t.Fatalf("readConfig return an error %v", err)
		}

		require.Equal(t, len(cfg), 1)

		dsCfg := cfg[0]

		require.Equal(t, dsCfg.APIVersion, int64(0))

		validateDatasourceV0(t, dsCfg)
		validateDeleteDatasources(t, dsCfg)
	})

	t.Run("Correlations", func(t *testing.T) {
		t.Run("Creates two correlations", func(t *testing.T) {
			store := &spyStore{}
			orgFake := &orgtest.FakeOrgService{}
			correlationsStore := &mockCorrelationsStore{}
			dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
			err := dc.applyChanges(context.Background(), oneDatasourceWithTwoCorrelations)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}

			require.Equal(t, 2, len(correlationsStore.created))
			// clean-up of provisioned correlations called once per inserted/updated data source
			require.Equal(t, 1, len(store.inserted))
			require.Equal(t, 1, len(correlationsStore.deletedBySourceUID))
			require.Equal(t, true, correlationsStore.deletedBySourceUID[0].OnlyProvisioned)
		})

		t.Run("Updating existing datasource deletes existing correlations and creates two", func(t *testing.T) {
			store := &spyStore{items: []*datasources.DataSource{{Name: "Graphite", OrgID: 1, ID: 1}}}
			orgFake := &orgtest.FakeOrgService{}
			correlationsStore := &mockCorrelationsStore{}
			dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
			err := dc.applyChanges(context.Background(), oneDatasourceWithTwoCorrelations)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}

			require.Equal(t, 2, len(correlationsStore.created))
			// clean-up of provisioned correlations called once per inserted/updated data source
			require.Equal(t, 1, len(store.updated))
			require.Equal(t, 1, len(correlationsStore.deletedBySourceUID))
			require.Equal(t, true, correlationsStore.deletedBySourceUID[0].OnlyProvisioned)
		})

		t.Run("Deleting datasource deletes existing correlations", func(t *testing.T) {
			store := &spyStore{items: []*datasources.DataSource{{Name: "old-data-source", OrgID: 1, ID: 1, UID: "some-uid"}}}
			orgFake := &orgtest.FakeOrgService{}
			targetUid := "target-uid"
			correlationsStore := &mockCorrelationsStore{items: []correlations.Correlation{{UID: "some-uid", SourceUID: "some-uid", TargetUID: &targetUid}}}
			dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
			err := dc.applyChanges(context.Background(), deleteOneDatasource)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}

			require.Equal(t, 0, len(correlationsStore.created))
			require.Equal(t, 1, len(store.deleted))
			// publish event is not skipped because data source is actually deleted
			require.Equal(t, false, store.deleted[0].SkipPublish)
		})

		t.Run("Re-creating datasource does not delete existing correlations", func(t *testing.T) {
			store := &spyStore{items: []*datasources.DataSource{{Name: "Test", OrgID: 1, UID: "test"}}}
			orgFake := &orgtest.FakeOrgService{}
			targetUid := "target-uid"
			correlationsStore := &mockCorrelationsStore{items: []correlations.Correlation{{UID: "some-uid", SourceUID: "some-uid", TargetUID: &targetUid}}}

			dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
			err := dc.applyChanges(context.Background(), recreateOneDatasource)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}

			require.Equal(t, 0, len(correlationsStore.created))
			require.Equal(t, 1, len(store.deleted))
			// publish event is skipped because...
			require.Equal(t, true, store.deleted[0].SkipPublish)
			// ... the data source is re-created...
			require.Equal(t, 1, len(store.inserted))
			require.Equal(t, store.deleted[0].Name, store.inserted[0].Name)

			// correlations for provisioned data sources are re-recreated
			require.Equal(t, 1, len(correlationsStore.deletedBySourceUID))
			require.Equal(t, true, correlationsStore.deletedBySourceUID[0].OnlyProvisioned)
		})

		t.Run("Using correct organization id", func(t *testing.T) {
			store := &spyStore{items: []*datasources.DataSource{{Name: "Foo", OrgID: 2, ID: 1}}}
			orgFake := &orgtest.FakeOrgService{}
			correlationsStore := &mockCorrelationsStore{}
			dc := newDatasourceProvisioner(logger, store, correlationsStore, orgFake)
			err := dc.applyChanges(context.Background(), correlationsDifferentOrganizations)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}

			require.Equal(t, 2, len(correlationsStore.created))
			// triggered for each provisioned data source
			require.Equal(t, 3, len(correlationsStore.deletedBySourceUID))
			require.Equal(t, int64(1), correlationsStore.deletedBySourceUID[0].OrgId)
			require.Equal(t, int64(2), correlationsStore.deletedBySourceUID[1].OrgId)
			require.Equal(t, int64(3), correlationsStore.deletedBySourceUID[2].OrgId)
		})
	})
}

func validateDeleteDatasources(t *testing.T, dsCfg *configs) {
	require.Equal(t, len(dsCfg.DeleteDatasources), 1)
	deleteDs := dsCfg.DeleteDatasources[0]
	require.Equal(t, deleteDs.Name, "old-graphite3")
	require.Equal(t, deleteDs.OrgID, int64(2))
}

func validateDatasourceV0(t *testing.T, dsCfg *configs) {
	ds := dsCfg.Datasources[0]
	require.Equal(t, ds.Name, "name")
	require.Equal(t, ds.Type, "type")
	require.Equal(t, ds.Access, datasources.DS_ACCESS_PROXY)
	require.Equal(t, ds.OrgID, int64(2))
	require.Equal(t, ds.URL, "url")
	require.Equal(t, ds.User, "user")
	require.Equal(t, ds.Database, "database")
	require.True(t, ds.BasicAuth)
	require.Equal(t, ds.BasicAuthUser, "basic_auth_user")
	require.True(t, ds.WithCredentials)
	require.True(t, ds.IsDefault)
	require.True(t, ds.Editable)
	require.Equal(t, ds.Version, 10)

	require.Greater(t, len(ds.JSONData), 2)
	require.Equal(t, ds.JSONData["graphiteVersion"], "1.1")
	require.Equal(t, ds.JSONData["tlsAuth"], true)
	require.Equal(t, ds.JSONData["tlsAuthWithCACert"], true)

	require.Greater(t, len(ds.SecureJSONData), 2)
	require.Equal(t, ds.SecureJSONData["tlsCACert"], "MjNOcW9RdkbUDHZmpco2HCYzVq9dE+i6Yi+gmUJotq5CDA==")
	require.Equal(t, ds.SecureJSONData["tlsClientCert"], "ckN0dGlyMXN503YNfjTcf9CV+GGQneN+xmAclQ==")
	require.Equal(t, ds.SecureJSONData["tlsClientKey"], "ZkN4aG1aNkja/gKAB1wlnKFIsy2SRDq4slrM0A==")
}

func validateDatasourceV1(t *testing.T, dsCfg *configs) {
	validateDatasourceV0(t, dsCfg)
	ds := dsCfg.Datasources[0]
	require.Equal(t, ds.UID, "test_uid")
	require.Equal(t, []map[string]any{{
		"targetUID":   "a target",
		"label":       "a label",
		"description": "a description",
		"config": map[string]any{
			"field": "fieldName",
			"target": map[string]any{
				"target": "test.query",
			},
		},
	}}, ds.Correlations)
}

type mockCorrelationsStore struct {
	created            []correlations.CreateCorrelationCommand
	deletedBySourceUID []correlations.DeleteCorrelationsBySourceUIDCommand
	deletedByTargetUID []correlations.DeleteCorrelationsByTargetUIDCommand
	items              []correlations.Correlation
}

func (m *mockCorrelationsStore) CreateCorrelation(c context.Context, cmd correlations.CreateCorrelationCommand) (correlations.Correlation, error) {
	m.created = append(m.created, cmd)
	return correlations.Correlation{}, nil
}

func (m *mockCorrelationsStore) CreateOrUpdateCorrelation(c context.Context, cmd correlations.CreateCorrelationCommand) error {
	m.created = append(m.created, cmd)
	return nil
}

func (m *mockCorrelationsStore) DeleteCorrelationsBySourceUID(c context.Context, cmd correlations.DeleteCorrelationsBySourceUIDCommand) error {
	m.deletedBySourceUID = append(m.deletedBySourceUID, cmd)
	return nil
}

func (m *mockCorrelationsStore) DeleteCorrelationsByTargetUID(c context.Context, cmd correlations.DeleteCorrelationsByTargetUIDCommand) error {
	m.deletedByTargetUID = append(m.deletedByTargetUID, cmd)
	return nil
}

type spyStore struct {
	inserted []*datasources.AddDataSourceCommand
	deleted  []*datasources.DeleteDataSourceCommand
	updated  []*datasources.UpdateDataSourceCommand
	items    []*datasources.DataSource
}

func (s *spyStore) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	for _, v := range s.items {
		if query.Name == v.Name && query.OrgID == v.OrgID {
			return v, nil
		}
	}
	return nil, datasources.ErrDataSourceNotFound
}

func (s *spyStore) GetPrunableProvisionedDataSources(ctx context.Context) ([]*datasources.DataSource, error) {
	prunableProvisionedDataSources := []*datasources.DataSource{}
	for _, item := range s.items {
		if item.IsPrunable {
			prunableProvisionedDataSources = append(prunableProvisionedDataSources, item)
		}
	}
	return prunableProvisionedDataSources, nil
}

func (s *spyStore) DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error {
	s.deleted = append(s.deleted, cmd)
	for i, v := range s.items {
		if cmd.Name == v.Name && cmd.OrgID == v.OrgID {
			cmd.DeletedDatasourcesCount = 1
			s.items = append(s.items[:i], s.items[i+1:]...)
			return nil
		}
	}
	return nil
}

func (s *spyStore) AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) (*datasources.DataSource, error) {
	s.inserted = append(s.inserted, cmd)
	newDataSource := &datasources.DataSource{UID: cmd.UID, Name: cmd.Name, OrgID: cmd.OrgID, IsPrunable: cmd.IsPrunable}
	s.items = append(s.items, newDataSource)
	return newDataSource, nil
}

func (s *spyStore) UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) (*datasources.DataSource, error) {
	s.updated = append(s.updated, cmd)
	return nil, nil
}
