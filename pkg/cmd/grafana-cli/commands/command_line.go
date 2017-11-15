package commands

import (
	"github.com/codegangsta/cli"
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
}

type contextCommandLine struct {
	*cli.Context
}

func (c *contextCommandLine) ShowHelp() {
	cli.ShowCommandHelp(c.Context, c.Command.Name)
}

func (c *contextCommandLine) ShowVersion() {
	cli.ShowVersion(c.Context)
}

func (c *contextCommandLine) Application() *cli.App {
	return c.App
}

func (c *contextCommandLine) PluginDirectory() string {
	return c.GlobalString("pluginsDir")
}

func (c *contextCommandLine) RepoDirectory() string {
	return c.GlobalString("repo")
}

func (c *contextCommandLine) PluginURL() string {
	return c.GlobalString("pluginUrl")
}
