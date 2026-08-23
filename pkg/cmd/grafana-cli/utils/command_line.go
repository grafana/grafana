package utils

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"

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
	GrafanaComProxyAPIToken() string
}

type ApiClient interface {
	GetPlugin(pluginId, repoUrl string) (models.Plugin, error)
	ListAllPlugins(repoUrl string) (models.PluginRepo, error)
}

type ContextCommandLine struct {
	*cli.Context

	// Config() parses the full configuration, which is too costly to repeat
	// for every lookup; memoize it per command invocation.
	cfgOnce   sync.Once
	parsedCfg *setting.Cfg
	cfgErr    error
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

/*
The plugin directory is determined in the following order:
1. --pluginsDir flag value if it is specified
2. --pluginsDir flag value if set via the environment variable called "GF_PLUGIN_DIR"
3. paths.plugins from configuration (GF_PATHS_PLUGINS environment variable,
   cfg:* overrides, config file, or conf/defaults.ini)
4. fallback to default value which depends on the operating system
**/

func (c *ContextCommandLine) PluginDirectory() string {
	// since the pluginsDir flag always has a value set by default we are checking in the flag lists
	// if the --pluginsDir flag was provided at all.
	if slices.Contains(c.FlagNames(), "pluginsDir") {
		return c.String("pluginsDir")
	}

	// Only parse configuration when the defaults file is resolvable:
	// setting.loadConfiguration exits when conf/defaults.ini cannot be found,
	// which must not turn config-less invocations into hard errors.
	if c.configResolvable() {
		cfg, err := c.Config()
		if err != nil {
			logger.Debug("Could not parse config file", err)
		} else if len(cfg.PluginsPaths) > 0 && cfg.PluginsPaths[0] != "" {
			// PluginsPaths[0] is the writable plugin dir, matching what the
			// server-side installer uses; [1] is the bundled plugins dir.
			return cfg.PluginsPaths[0]
		}
	}

	// fallback to flag value
	return c.String("pluginsDir")
}

// configResolvable reports whether loading the full configuration can succeed.
// setting.loadConfiguration exits the process when <homepath>/conf/defaults.ini
// is missing, so probe for that file before attempting a load. The candidates
// must mirror setHomePath exactly: an explicit --homepath is used verbatim,
// while an empty one falls back to the working directory and then its parent.
func (c *ContextCommandLine) configResolvable() bool {
	home := c.HomePath()
	var candidates []string
	if home != "" {
		candidates = []string{filepath.Join(home, "conf", "defaults.ini")}
	} else {
		candidates = []string{
			filepath.Join(".", "conf", "defaults.ini"),
			filepath.Join("..", "conf", "defaults.ini"),
		}
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	return false
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
	c.cfgOnce.Do(func() {
		configOptions := strings.Split(c.String("configOverrides"), " ")
		c.parsedCfg, c.cfgErr = setting.NewCfgFromArgs(setting.CommandLineArgs{
			Config:   c.ConfigFile(),
			HomePath: c.HomePath(),
			Args:     append(configOptions, c.Args().Slice()...),
		})
	})
	return c.parsedCfg, c.cfgErr
}

func (c *ContextCommandLine) GcomToken() string {
	cfg, err := c.Config()

	if err != nil {
		logger.Debug("Could not parse config file", err)
		return ""
	}
	return cfg.GrafanaComSSOAPIToken
}

func (c *ContextCommandLine) GrafanaComProxyAPIToken() string {
	cfg, err := c.Config()

	if err != nil {
		logger.Debug("Could not parse config file", err)
		return ""
	}
	if cfg.GrafanaComProxyAPIToken != "" {
		return cfg.GrafanaComProxyAPIToken
	}
	return cfg.GrafanaComSSOAPIToken
}

func (c *ContextCommandLine) PluginURL() string {
	return c.String("pluginUrl")
}
