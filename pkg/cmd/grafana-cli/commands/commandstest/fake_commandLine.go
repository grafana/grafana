package commandstest

import (
	"github.com/codegangsta/cli"
)

type FakeFlagger struct {
	Data map[string]interface{}
}

type FakeCommandLine struct {
	LocalFlags, GlobalFlags *FakeFlagger
	HelpShown, VersionShown bool
	CliArgs                 []string
}

func (ff FakeFlagger) String(key string) string {
	if value, ok := ff.Data[key]; ok {
		return value.(string)
	}
	return ""
}

func (ff FakeFlagger) StringSlice(key string) []string {
	if value, ok := ff.Data[key]; ok {
		return value.([]string)
	}
	return []string{}
}

func (ff FakeFlagger) Int(key string) int {
	if value, ok := ff.Data[key]; ok {
		return value.(int)
	}
	return 0
}

func (ff FakeFlagger) Bool(key string) bool {
	if value, ok := ff.Data[key]; ok {
		return value.(bool)
	}
	return false
}

func (fcli *FakeCommandLine) String(key string) string {
	return fcli.LocalFlags.String(key)
}

func (fcli *FakeCommandLine) StringSlice(key string) []string {
	return fcli.LocalFlags.StringSlice(key)
}

func (fcli *FakeCommandLine) Int(key string) int {
	return fcli.LocalFlags.Int(key)
}

func (fcli *FakeCommandLine) Bool(key string) bool {
	if fcli.LocalFlags == nil {
		return false
	}
	return fcli.LocalFlags.Bool(key)
}

func (fcli *FakeCommandLine) GlobalString(key string) string {
	return fcli.GlobalFlags.String(key)
}

func (fcli *FakeCommandLine) Generic(name string) interface{} {
	return fcli.LocalFlags.Data[name]
}

func (fcli *FakeCommandLine) FlagNames() []string {
	flagNames := []string{}
	for key := range fcli.LocalFlags.Data {
		flagNames = append(flagNames, key)
	}

	return flagNames
}

func (fcli *FakeCommandLine) ShowHelp() {
	fcli.HelpShown = true
}

func (fcli *FakeCommandLine) Application() *cli.App {
	return cli.NewApp()
}

func (fcli *FakeCommandLine) Args() cli.Args {
	return fcli.CliArgs
}

func (fcli *FakeCommandLine) ShowVersion() {
	fcli.VersionShown = true
}

func (fcli *FakeCommandLine) RepoDirectory() string {
	return fcli.GlobalString("repo")
}

func (fcli *FakeCommandLine) PluginDirectory() string {
	return fcli.GlobalString("pluginsDir")
}

func (fcli *FakeCommandLine) PluginURL() string {
	return fcli.GlobalString("pluginUrl")
}
