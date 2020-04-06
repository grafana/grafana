package utils

import (
	"os"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/urfave/cli/v2"
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
	Generic(name string) interface{}

	PluginDirectory() string
	RepoDirectory() string
	PluginURL() string
}

type ApiClient interface {
	GetPlugin(pluginId, repoUrl string) (models.Plugin, error)
	DownloadFile(pluginName string, tmpFile *os.File, url string, checksum string) (err error)
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

func (c *ContextCommandLine) RepoDirectory() string {
	return c.String("repo")
}

func (c *ContextCommandLine) PluginURL() string {
	return c.String("pluginUrl")
}

func (c *ContextCommandLine) OptionsString() string {
	return c.String("configOverrides")
}
