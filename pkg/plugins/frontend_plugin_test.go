package plugins

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestFrontendPlugin(t *testing.T) {
	t.Run("When setting paths based on App on Windows", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.StaticRootPath = "c:\\grafana\\public"

		fp := &FrontendPluginBase{
			PluginBase: PluginBase{
				PluginDir: "c:\\grafana\\public\\app\\plugins\\app\\testdata\\datasources\\datasource",
				BaseUrl:   "fpbase",
			},
		}
		app := &AppPlugin{
			FrontendPluginBase: FrontendPluginBase{
				PluginBase: PluginBase{
					PluginDir: "c:\\grafana\\public\\app\\plugins\\app\\testdata",
					Id:        "testdata",
					BaseUrl:   "public/app/plugins/app/testdata",
				},
			},
		}

		fp.setPathsBasedOnApp(app, cfg)
		require.Equal(t, "app/plugins/app/testdata/datasources/datasource/module", fp.Module)
	})
}
