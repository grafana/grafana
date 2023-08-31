package commands

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/loki"
	"github.com/grafana/grafana/pkg/tsdb/mssql"
	"github.com/grafana/grafana/pkg/tsdb/mysql"
	"github.com/grafana/grafana/pkg/tsdb/parca"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
	"github.com/urfave/cli/v2"
)

func serveBackendPluginCommand(context *cli.Context) error {
	cmd := &utils.ContextCommandLine{Context: context}
	configOptions := strings.Split(cmd.String("configOverrides"), " ")
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   cmd.ConfigFile(),
		HomePath: cmd.HomePath(),
		// tailing arguments have precedence over the options string
		Args: append(configOptions, cmd.Args().Slice()...),
	})
	if err != nil {
		return err
	}

	// Setup standard wire things (if complex, we could use wire?)
	clientprovider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{})
	features, err := featuremgmt.ProvideManagerService(cfg, licensing.ProvideService(cfg, nil))
	if err != nil {
		return err
	}
	tracer, err := tracing.ProvideService(cfg)
	if err != nil {
		return err
	}

	pluginID := context.Args().First()
	var opts *backend.ServeOpts
	switch pluginID {
	case "loki":
		s := loki.ProvideService(clientprovider, features, tracer)
		opts = &backend.ServeOpts{
			//CheckHealthHandler:  s,
			CallResourceHandler: s,
			QueryDataHandler:    s,
			StreamHandler:       s,
		}
	case "mssql":
		s := mssql.ProvideService(cfg)
		opts = &backend.ServeOpts{
			CheckHealthHandler: s,
			//CallResourceHandler: s,
			QueryDataHandler: s,
			//StreamHandler:       s,
		}
	case "mysql":
		s := mysql.ProvideService(cfg, clientprovider)
		opts = &backend.ServeOpts{
			CheckHealthHandler: s,
			//CallResourceHandler: s,
			QueryDataHandler: s,
			//StreamHandler:       s,
		}
	case "parca":
		s := parca.ProvideService(clientprovider)
		opts = &backend.ServeOpts{
			CheckHealthHandler:  s,
			CallResourceHandler: s,
			QueryDataHandler:    s,
			//StreamHandler:       s,
		}
	case "testdatasource":
		s := testdatasource.ProvideService()
		opts = &backend.ServeOpts{
			//	CheckHealthHandler:  s,
			CallResourceHandler: s,
			QueryDataHandler:    s,
			StreamHandler:       s,
		}
	default:
		return fmt.Errorf("missing <pluginid> (only core work now!)")
	}
	return backend.Serve(*opts)
}
