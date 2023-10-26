package plugincontext_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	pluginFakes "github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGetAlias(t *testing.T) {
	const (
		pluginID = "plugin-id"
		alias    = "alias"
	)

	cfg := setting.NewCfg()
	ds := &fakeDatasources.FakeDataSourceService{}
	db := &dbtest.FakeDB{ExpectedError: pluginsettings.ErrPluginSettingNotFound}
	pcp := plugincontext.ProvideService(cfg, localcache.ProvideService(),
		&pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:       pluginID,
						AliasIDs: []string{alias},
					},
				},
			},
		},
		ds, pluginSettings.ProvideService(db, secretstest.NewFakeSecretsService()), pluginFakes.NewFakeLicensingService(), &config.Cfg{},
	)
	identity := &user.SignedInUser{OrgID: int64(1), Login: "admin"}

	for _, tc := range []struct {
		name  string
		input string
	}{
		{"by id", pluginID},
		{"by alias", alias},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Run("Get", func(t *testing.T) {
				pCtx, err := pcp.Get(context.Background(), tc.input, identity, identity.OrgID)
				require.NoError(t, err)
				require.Equal(t, pluginID, pCtx.PluginID)
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
			})
		})
	}
}
