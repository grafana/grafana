package commandstest

import (
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/urfave/cli/v2"
)

type FakeFlagger struct {
	Data map[string]interface{}
}

type FakeCommandLine struct {
	LocalFlags, GlobalFlags *FakeFlagger
	HelpShown, VersionShown bool
	CliArgs                 cli.Args
	Client                  utils.ApiClient
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

func (fcli *FakeCommandLine) ShowHelp() error {
	fcli.HelpShown = true
	return nil
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
	return fcli.String("repo")
}

func (fcli *FakeCommandLine) PluginDirectory() string {
	return fcli.String("pluginsDir")
}

func (fcli *FakeCommandLine) PluginURL() string {
	return fcli.String("pluginUrl")
}

func (fcli *FakeCommandLine) ApiClient() utils.ApiClient {
	return fcli.Client
}

type FakeArgs []string

func (a FakeArgs) Get(n int) string {
	if len(a) > n {
		return a[n]
	}
	return ""
}

func (a FakeArgs) First() string {
	return a.Get(0)
}

func (a FakeArgs) Tail() []string {
	if len(a) >= 2 {
		tail := []string(a[1:])
		ret := make([]string, len(tail))
		copy(ret, tail)
		return ret
	}
	return []string{}
}

func (a FakeArgs) Len() int {
	return len(a)
}

func (a FakeArgs) Present() bool {
	return len(a) > 0
}

func (a FakeArgs) Slice() []string {
	ret := make([]string, len(a))
	copy(ret, a)
	return ret
}
