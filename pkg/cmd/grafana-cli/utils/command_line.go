package utils

import (
	"slices"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/setting"
)

type CommandLine interface {
	ShowHelp() error
	ShowVersion()
	Application() *cli.App
	Args() cli.Args
	Bool(name string) bool
	Int(name string) int
	String(name string) string
	StringSlice(name string) []string
	FlagNames() (names []string)
	Generic(name string) any

	PluginDirectory() string
	PluginRepoURL() string
	PluginURL() string
	GcomToken() string
}

type ApiClient interface {
	GetPlugin(pluginId, repoUrl string) (models.Plugin, error)
	ListAllPlugins(repoUrl string) (models.PluginRepo, error)
}

type ContextCommandLine struct {
	*cli.Context
}

func (c *ContextCommandLine) ShowHelp() error {
	return cli.ShowCommandHelp(c.Context, c.Command.Name)
}

func (c *ContextCommandLine) ShowVersion() {
	cli.ShowVersion(c.Context)
}

func (c *ContextCommandLine) Application() *cli.App {
	return c.App
}

func (c *ContextCommandLine) HomePath() string { return c.String("homepath") }

func (c *ContextCommandLine) ConfigFile() string { return c.String("config") }

func (c *ContextCommandLine) PluginDirectory() string {
	return c.String("pluginsDir")
}

/*
The plugin repository URL is determined in the following order:
1. --repo flag value if it is specified
2. --repo flag value if set via the environment variable called "GF_PLUGIN_REPO"
3. --configOverrides parameter (only if --config is set too)
4. --config parameter, from which we are looking at GrafanaComAPIURL setting
5. fallback to default value which is https://grafana.com/api/plugins
**/

func (c *ContextCommandLine) PluginRepoURL() string {
	// if --repo flag is set, use it
	// since the repo flag always has a value set by default we are checking in the flag lists if the --repo flag was provided at all.
	if slices.Contains(c.FlagNames(), "repo") {
		return c.String("repo")
	}

	// if --config flag is set, try to get the GrafanaComAPIURL setting
	if c.ConfigFile() != "" {
		cfg, err := c.Config()

		if err != nil {
			logger.Debug("Could not parse config file", err)
		} else if cfg.GrafanaComAPIURL != "" {
			return cfg.GrafanaComAPIURL + "/plugins"
		}
	}
	// fallback to default value
	return c.String("repo")
}

func (c *ContextCommandLine) Config() (*setting.Cfg, error) {
	configOptions := strings.Split(c.String("configOverrides"), " ")
	return setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   c.ConfigFile(),
		HomePath: c.HomePath(),
		Args:     append(configOptions, c.Args().Slice()...),
	})
}

func (c *ContextCommandLine) GcomToken() string {
	cfg, err := c.Config()

	if err != nil {
		logger.Debug("Could not parse config file", err)
		return ""
	}
	return cfg.GrafanaComSSOAPIToken
}

func (c *ContextCommandLine) PluginURL() string {
	return c.String("pluginUrl")
}
