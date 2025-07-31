package plugincontext_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/plugins"
	pluginFakes "github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGet(t *testing.T) {
	const (
		pluginID = "plugin-id"
		alias    = "alias"
	)

	preg := registry.NewInMemory()
	require.NoError(t, preg.Add(context.Background(), &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:       pluginID,
			AliasIDs: []string{alias},
		},
	}))

	cfg := setting.NewCfg()
	ds := &fakeDatasources.FakeDataSourceService{}
	db := &dbtest.FakeDB{ExpectedError: pluginsettings.ErrPluginSettingNotFound}
	pcp := plugincontext.ProvideService(setting.ProvideService(cfg), localcache.ProvideService(),
		pluginstore.New(preg, &pluginFakes.FakeLoader{}), &fakeDatasources.FakeCacheService{},
		ds, pluginSettings.ProvideService(db, secretstest.NewFakeSecretsService()), pluginconfig.NewFakePluginRequestConfigProvider(),
	)
	identity := &user.SignedInUser{OrgID: int64(1), Login: "admin"}

	for _, tc := range []struct {
		name  string
		input string
	}{
		{"with id", pluginID},
		{"with alias", alias},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Run("Get", func(t *testing.T) {
				pCtx, err := pcp.Get(context.Background(), tc.input, identity, identity.OrgID)
				require.NoError(t, err)
				require.Equal(t, pluginID, pCtx.PluginID)
				require.NotNil(t, pCtx.GrafanaConfig)
			})

			t.Run("GetWithDataSource", func(t *testing.T) {
				pCtx, err := pcp.GetWithDataSource(context.Background(), tc.input, identity, &datasources.DataSource{
					ID:       1,
					OrgID:    1,
					Name:     "test",
					Type:     pluginID,
					JsonData: simplejson.New(),
				})
				require.NoError(t, err)
				require.Equal(t, pluginID, pCtx.PluginID)
				require.NotNil(t, pCtx.GrafanaConfig)
			})
		})
	}
}
