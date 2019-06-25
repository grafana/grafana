package utils

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
