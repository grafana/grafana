package datasources

import (
	"context"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

var (
	logger log.Logger = log.New("fake.log")

	twoDatasourcesConfig            = "testdata/two-datasources"
	twoDatasourcesConfigPurgeOthers = "testdata/insert-two-delete-two"
	doubleDatasourcesConfig         = "testdata/double-default"
	allProperties                   = "testdata/all-properties"
	versionZero                     = "testdata/version-0"
	brokenYaml                      = "testdata/broken-yaml"
	multipleOrgsWithDefault         = "testdata/multiple-org-default"
	withoutDefaults                 = "testdata/appliedDefaults"
	invalidAccess                   = "testdata/invalid-access"

	fakeRepo *fakeRepository
)

func TestDatasourceAsConfig(t *testing.T) {
	setup := func() {
		fakeRepo = &fakeRepository{}
		bus.ClearBusHandlers()
		bus.AddHandler("test", mockDelete)
		bus.AddHandler("test", mockInsert)
		bus.AddHandler("test", mockUpdate)
		bus.AddHandler("test", mockGet)
		bus.AddHandler("test", mockGetOrg)
	}

	t.Run("apply default values when missing", func(t *testing.T) {
		setup()
		dc := newDatasourceProvisioner(logger)
		err := dc.applyChanges(context.Background(), withoutDefaults)
		if err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(fakeRepo.inserted), 1)
		require.Equal(t, fakeRepo.inserted[0].OrgId, int64(1))
		require.Equal(t, fakeRepo.inserted[0].Access, models.DsAccess("proxy"))
		require.Equal(t, fakeRepo.inserted[0].Name, "My datasource name")
		require.Equal(t, fakeRepo.inserted[0].Uid, "P2AD1F727255C56BA")
	})

	t.Run("no datasource in database", func(t *testing.T) {
		setup()
		dc := newDatasourceProvisioner(logger)
		err := dc.applyChanges(context.Background(), twoDatasourcesConfig)
		if err != nil {
			t.Fatalf("applyChanges return an error %v", err)
		}

		require.Equal(t, len(fakeRepo.deleted), 0)
		require.Equal(t, len(fakeRepo.inserted), 2)
		require.Equal(t, len(fakeRepo.updated), 0)
	})

	t.Run("One datasource in database with same name", func(t *testing.T) {
		setup()
		fakeRepo.loadAll = []*models.DataSource{
			{Name: "Graphite", OrgId: 1, Id: 1},
		}

		t.Run("should update one datasource", func(t *testing.T) {
			dc := newDatasourceProvisioner(logger)
			err := dc.applyChanges(context.Background(), twoDatasourcesConfig)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}

			require.Equal(t, len(fakeRepo.deleted), 0)
			require.Equal(t, len(fakeRepo.inserted), 1)
			require.Equal(t, len(fakeRepo.updated), 1)
		})
	})

	t.Run("Two datasources with is_default", func(t *testing.T) {
		setup()
		dc := newDatasourceProvisioner(logger)
		err := dc.applyChanges(context.Background(), doubleDatasourcesConfig)
		t.Run("should raise error", func(t *testing.T) { require.Equal(t, err, ErrInvalidConfigToManyDefault) })
	})

	t.Run("Multiple datasources in different organizations with isDefault in each organization", func(t *testing.T) {
		setup()
		dc := newDatasourceProvisioner(logger)
		err := dc.applyChanges(context.Background(), multipleOrgsWithDefault)
		t.Run("should not raise error", func(t *testing.T) {
			require.NoError(t, err)
			require.Equal(t, len(fakeRepo.inserted), 4)
			require.True(t, fakeRepo.inserted[0].IsDefault)
			require.Equal(t, fakeRepo.inserted[0].OrgId, int64(1))
			require.True(t, fakeRepo.inserted[2].IsDefault)
			require.Equal(t, fakeRepo.inserted[2].OrgId, int64(2))
		})
	})

	t.Run("Two configured datasource and purge others ", func(t *testing.T) {
		setup()
		t.Run("two other datasources in database", func(t *testing.T) {
			fakeRepo.loadAll = []*models.DataSource{
				{Name: "old-graphite", OrgId: 1, Id: 1},
				{Name: "old-graphite2", OrgId: 1, Id: 2},
			}

			t.Run("should have two new datasources", func(t *testing.T) {
				dc := newDatasourceProvisioner(logger)
				err := dc.applyChanges(context.Background(), twoDatasourcesConfigPurgeOthers)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}

				require.Equal(t, len(fakeRepo.deleted), 2)
				require.Equal(t, len(fakeRepo.inserted), 2)
				require.Equal(t, len(fakeRepo.updated), 0)
			})
		})
	})

	t.Run("Two configured datasource and purge others = false", func(t *testing.T) {
		setup()
		t.Run("two other datasources in database", func(t *testing.T) {
			fakeRepo.loadAll = []*models.DataSource{
				{Name: "Graphite", OrgId: 1, Id: 1},
				{Name: "old-graphite2", OrgId: 1, Id: 2},
			}

			t.Run("should have two new datasources", func(t *testing.T) {
				dc := newDatasourceProvisioner(logger)
				err := dc.applyChanges(context.Background(), twoDatasourcesConfig)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}

				require.Equal(t, len(fakeRepo.deleted), 0)
				require.Equal(t, len(fakeRepo.inserted), 1)
				require.Equal(t, len(fakeRepo.updated), 1)
			})
		})
	})

	t.Run("broken yaml should return error", func(t *testing.T) {
		reader := &configReader{}
		_, err := reader.readConfig(context.Background(), brokenYaml)
		require.NotNil(t, err)
	})

	t.Run("invalid access should warn about invalid value and return 'proxy'", func(t *testing.T) {
		reader := &configReader{log: logger}
		configs, err := reader.readConfig(context.Background(), invalidAccess)
		require.NoError(t, err)
		require.Equal(t, configs[0].Datasources[0].Access, models.DS_ACCESS_PROXY)
	})

	t.Run("skip invalid directory", func(t *testing.T) {
		cfgProvider := &configReader{log: log.New("test logger")}
		cfg, err := cfgProvider.readConfig(context.Background(), "./invalid-directory")
		if err != nil {
			t.Fatalf("readConfig return an error %v", err)
		}

		require.Equal(t, len(cfg), 0)
	})

	t.Run("can read all properties from version 1", func(t *testing.T) {
		_ = os.Setenv("TEST_VAR", "name")
		cfgProvider := &configReader{log: log.New("test logger")}
		cfg, err := cfgProvider.readConfig(context.Background(), allProperties)
		_ = os.Unsetenv("TEST_VAR")
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
		cfgProvider := &configReader{log: log.New("test logger")}
		cfg, err := cfgProvider.readConfig(context.Background(), versionZero)
		if err != nil {
			t.Fatalf("readConfig return an error %v", err)
		}

		require.Equal(t, len(cfg), 1)

		dsCfg := cfg[0]

		require.Equal(t, dsCfg.APIVersion, int64(0))

		validateDatasource(t, dsCfg)
		validateDeleteDatasources(t, dsCfg)
	})
}

func TestUIDFromNames(t *testing.T) {
	t.Run("generate safe uid from name", func(t *testing.T) {
		require.Equal(t, safeUIDFromName("Hello world"), "P64EC88CA00B268E5")
		require.Equal(t, safeUIDFromName("Hello World"), "PA591A6D40BF42040")
		require.Equal(t, safeUIDFromName("AAA"), "PCB1AD2119D8FAFB6")
	})
}

func validateDeleteDatasources(t *testing.T, dsCfg *configs) {
	require.Equal(t, len(dsCfg.DeleteDatasources), 1)
	deleteDs := dsCfg.DeleteDatasources[0]
	require.Equal(t, deleteDs.Name, "old-graphite3")
	require.Equal(t, deleteDs.OrgID, int64(2))
}

func validateDatasource(t *testing.T, dsCfg *configs) {
	ds := dsCfg.Datasources[0]
	require.Equal(t, ds.Name, "name")
	require.Equal(t, ds.Type, "type")
	require.Equal(t, ds.Access, models.DS_ACCESS_PROXY)
	require.Equal(t, ds.OrgID, int64(2))
	require.Equal(t, ds.URL, "url")
	require.Equal(t, ds.User, "user")
	require.Equal(t, ds.Password, "password")
	require.Equal(t, ds.Database, "database")
	require.True(t, ds.BasicAuth)
	require.Equal(t, ds.BasicAuthUser, "basic_auth_user")
	require.Equal(t, ds.BasicAuthPassword, "basic_auth_password")
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
	validateDatasource(t, dsCfg)
	ds := dsCfg.Datasources[0]
	require.Equal(t, ds.UID, "test_uid")
}

type fakeRepository struct {
	inserted []*models.AddDataSourceCommand
	deleted  []*models.DeleteDataSourceCommand
	updated  []*models.UpdateDataSourceCommand

	loadAll []*models.DataSource
}

func mockDelete(cmd *models.DeleteDataSourceCommand) error {
	fakeRepo.deleted = append(fakeRepo.deleted, cmd)
	return nil
}

func mockUpdate(cmd *models.UpdateDataSourceCommand) error {
	fakeRepo.updated = append(fakeRepo.updated, cmd)
	return nil
}

func mockInsert(cmd *models.AddDataSourceCommand) error {
	fakeRepo.inserted = append(fakeRepo.inserted, cmd)
	return nil
}

func mockGet(cmd *models.GetDataSourceQuery) error {
	for _, v := range fakeRepo.loadAll {
		if cmd.Name == v.Name && cmd.OrgId == v.OrgId {
			cmd.Result = v
			return nil
		}
	}

	return models.ErrDataSourceNotFound
}

func mockGetOrg(_ *models.GetOrgByIdQuery) error {
	return nil
}
