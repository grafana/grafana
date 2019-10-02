package utils

import (
	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
)

type CommandLine interface {
	ShowHelp()
	ShowVersion()
	Application() *cli.App
	Args() cli.Args
	Bool(name string) bool
	Int(name string) int
	String(name string) string
	StringSlice(name string) []string
	GlobalString(name string) string
	FlagNames() (names []string)
	Generic(name string) interface{}

	PluginDirectory() string
	RepoDirectory() string
	PluginURL() string
	ApiClient() ApiClient
}

type ApiClient interface {
	GetPlugin(pluginId, repoUrl string) (models.Plugin, error)
	DownloadFile(pluginName, filePath, url string, checksum string) (content []byte, err error)
	ListAllPlugins(repoUrl string) (models.PluginRepo, error)
}

type ContextCommandLine struct {
	*cli.Context
}

func (c *ContextCommandLine) ShowHelp() {
	cli.ShowCommandHelp(c.Context, c.Command.Name)
}

func (c *ContextCommandLine) ShowVersion() {
	cli.ShowVersion(c.Context)
}

func (c *ContextCommandLine) Application() *cli.App {
	return c.App
}

func (c *ContextCommandLine) HomePath() string { return c.GlobalString("homepath") }

func (c *ContextCommandLine) ConfigFile() string { return c.GlobalString("config") }

func (c *ContextCommandLine) PluginDirectory() string {
	return c.GlobalString("pluginsDir")
}

func (c *ContextCommandLine) RepoDirectory() string {
	return c.GlobalString("repo")
}

func (c *ContextCommandLine) PluginURL() string {
	return c.GlobalString("pluginUrl")
}

func (c *ContextCommandLine) OptionsString() string {
	return c.GlobalString("configOverrides")
}

func (c *ContextCommandLine) ApiClient() ApiClient {
	return &services.GrafanaComClient{}
}
