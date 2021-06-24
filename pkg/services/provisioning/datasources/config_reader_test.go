package datasources

import (
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
	t.Run("Testing datasource as configuration", func(t *testing.T) {
		fakeRepo = &fakeRepository{}
		bus.ClearBusHandlers()
		bus.AddHandler("test", mockDelete)
		bus.AddHandler("test", mockInsert)
		bus.AddHandler("test", mockUpdate)
		bus.AddHandler("test", mockGet)
		bus.AddHandler("test", mockGetOrg)

		t.Run("apply default values when missing", func(t *testing.T) {
			dc := newDatasourceProvisioner(logger)
			err := dc.applyChanges(withoutDefaults)
			if err != nil {
				t.Fatalf("applyChanges return an error %v", err)
			}

			require.Equal(t, 1, len(fakeRepo.inserted))
			require.Equal(t, 1, fakeRepo.inserted[0].OrgId)
			require.Equal(t, "proxy", fakeRepo.inserted[0].Access)
		})

		t.Run("One configured datasource", func(t *testing.T) {
			t.Run("no datasource in database", func(t *testing.T) {
				dc := newDatasourceProvisioner(logger)
				err := dc.applyChanges(twoDatasourcesConfig)
				if err != nil {
					t.Fatalf("applyChanges return an error %v", err)
				}

				require.Equal(t, 0, len(fakeRepo.deleted))
				require.Equal(t, 2, len(fakeRepo.inserted))
				require.Equal(t, 0, len(fakeRepo.updated))
			})

			t.Run("One datasource in database with same name", func(t *testing.T) {
				fakeRepo.loadAll = []*models.DataSource{
					{Name: "Graphite", OrgId: 1, Id: 1},
				}

				t.Run("should update one datasource", func(t *testing.T) {
					dc := newDatasourceProvisioner(logger)
					err := dc.applyChanges(twoDatasourcesConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					require.Equal(t, 0, len(fakeRepo.deleted))
					require.Equal(t, 1, len(fakeRepo.inserted))
					require.Equal(t, 1, len(fakeRepo.updated))
				})
			})

			t.Run("Two datasources with is_default", func(t *testing.T) {
				dc := newDatasourceProvisioner(logger)
				err := dc.applyChanges(doubleDatasourcesConfig)
				t.Run("should raise error", func(t *testing.T) {
					require.Equal(t, ErrInvalidConfigToManyDefault, err)
				})
			})
		})

		t.Run("Multiple datasources in different organizations with isDefault in each organization", func(t *testing.T) {
			dc := newDatasourceProvisioner(logger)
			err := dc.applyChanges(multipleOrgsWithDefault)
			t.Run("should not raise error", func(t *testing.T) {
				require.NoError(t, err)
				require.Equal(t, 4, len(fakeRepo.inserted))
				require.True(t, fakeRepo.inserted[0].IsDefault)
				require.Equal(t, 1, fakeRepo.inserted[0].OrgId)
				require.True(t, fakeRepo.inserted[2].IsDefault)
				require.Equal(t, 2, fakeRepo.inserted[2].OrgId)
			})
		})

		t.Run("Two configured datasource and purge others ", func(t *testing.T) {
			t.Run("two other datasources in database", func(t *testing.T) {
				fakeRepo.loadAll = []*models.DataSource{
					{Name: "old-graphite", OrgId: 1, Id: 1},
					{Name: "old-graphite2", OrgId: 1, Id: 2},
				}

				t.Run("should have two new datasources", func(t *testing.T) {
					dc := newDatasourceProvisioner(logger)
					err := dc.applyChanges(twoDatasourcesConfigPurgeOthers)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					require.Equal(t, 2, len(fakeRepo.deleted))
					require.Equal(t, 2, len(fakeRepo.inserted))
					require.Equal(t, 0, len(fakeRepo.updated))
				})
			})
		})

		t.Run("Two configured datasource and purge others = false", func(t *testing.T) {
			t.Run("two other datasources in database", func(t *testing.T) {
				fakeRepo.loadAll = []*models.DataSource{
					{Name: "Graphite", OrgId: 1, Id: 1},
					{Name: "old-graphite2", OrgId: 1, Id: 2},
				}

				t.Run("should have two new datasources", func(t *testing.T) {
					dc := newDatasourceProvisioner(logger)
					err := dc.applyChanges(twoDatasourcesConfig)
					if err != nil {
						t.Fatalf("applyChanges return an error %v", err)
					}

					require.Equal(t, 0, len(fakeRepo.deleted))
					require.Equal(t, 1, len(fakeRepo.inserted))
					require.Equal(t, 1, len(fakeRepo.updated))
				})
			})
		})

		t.Run("broken yaml should return error", func(t *testing.T) {
			reader := &configReader{}
			_, err := reader.readConfig(brokenYaml)
			require.Error(t, err)
		})

		t.Run("invalid access should warn about invalid value and return 'proxy'", func(t *testing.T) {
			reader := &configReader{log: logger}
			configs, err := reader.readConfig(invalidAccess)
			require.NoError(t, err)
			require.Equal(t, models.DS_ACCESS_PROXY, configs[0].Datasources[0].Access)
		})

		t.Run("skip invalid directory", func(t *testing.T) {
			cfgProvider := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvider.readConfig("./invalid-directory")
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			require.Equal(t, 0, len(cfg))
		})

		t.Run("can read all properties from version 1", func(t *testing.T) {
			_ = os.Setenv("TEST_VAR", "name")
			cfgProvider := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvider.readConfig(allProperties)
			_ = os.Unsetenv("TEST_VAR")
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			require.Equal(t, 3, len(cfg))

			dsCfg := cfg[0]

			require.Equal(t, 1, dsCfg.APIVersion)

			validateDatasourceV1(dsCfg, t)
			validateDeleteDatasources(dsCfg, t)

			dsCount := 0
			delDsCount := 0

			for _, c := range cfg {
				dsCount += len(c.Datasources)
				delDsCount += len(c.DeleteDatasources)
			}

			require.Equal(t, 2, dsCount)
			require.Equal(t, 1, delDsCount)
		})

		t.Run("can read all properties from version 0", func(t *testing.T) {
			cfgProvider := &configReader{log: log.New("test logger")}
			cfg, err := cfgProvider.readConfig(versionZero)
			if err != nil {
				t.Fatalf("readConfig return an error %v", err)
			}

			require.Equal(t, 1, len(cfg))

			dsCfg := cfg[0]

			require.Equal(t, 0, dsCfg.APIVersion)

			validateDatasource(dsCfg, t)
			validateDeleteDatasources(dsCfg, t)
		})
	})
}

func validateDeleteDatasources(dsCfg *configs, t *testing.T) {
	require.Equal(t, 1, len(dsCfg.DeleteDatasources))
	deleteDs := dsCfg.DeleteDatasources[0]
	require.Equal(t, "old-graphite3", deleteDs.Name)
	require.Equal(t, 2, deleteDs.OrgID)
}

func validateDatasource(dsCfg *configs, t *testing.T) {
	ds := dsCfg.Datasources[0]
	require.Equal(t, "name", ds.Name)
	require.Equal(t, "type", ds.Type)
	require.Equal(t, models.DS_ACCESS_PROXY, ds.Access)
	require.Equal(t, 2, ds.OrgID)
	require.Equal(t, "url", ds.URL)
	require.Equal(t, "user", ds.User)
	require.Equal(t, "password", ds.Password)
	require.Equal(t, "database", ds.Database)
	require.True(t, ds.BasicAuth)
	require.Equal(t, "basic_auth_user", ds.BasicAuthUser)
	require.Equal(t, "basic_auth_password", ds.BasicAuthPassword)
	require.True(t, ds.WithCredentials)
	require.True(t, ds.IsDefault)
	require.True(t, ds.Editable)
	require.Equal(t, 10, ds.Version)

	require.Greater(t, len(ds.JSONData), 2)
	require.Equal(t, "1.1", ds.JSONData["graphiteVersion"])
	require.Equal(t, true, ds.JSONData["tlsAuth"])
	require.Equal(t, true, ds.JSONData["tlsAuthWithCACert"])

	require.Greater(t, len(ds.SecureJSONData), 2)
	require.Equal(t, "MjNOcW9RdkbUDHZmpco2HCYzVq9dE+i6Yi+gmUJotq5CDA==", ds.SecureJSONData["tlsCACert"])
	require.Equal(t, "ckN0dGlyMXN503YNfjTcf9CV+GGQneN+xmAclQ==", ds.SecureJSONData["tlsClientCert"])
	require.Equal(t, "ZkN4aG1aNkja/gKAB1wlnKFIsy2SRDq4slrM0A==", ds.SecureJSONData["tlsClientKey"])
}

func validateDatasourceV1(dsCfg *configs, t *testing.T) {
	validateDatasource(dsCfg, t)
	ds := dsCfg.Datasources[0]
	require.Equal(t, "test_uid", ds.UID)
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
