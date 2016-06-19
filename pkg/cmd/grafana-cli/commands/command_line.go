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
