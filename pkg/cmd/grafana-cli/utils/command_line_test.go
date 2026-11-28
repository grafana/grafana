package utils

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
)

func configFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{Name: "config"},
		&cli.StringFlag{Name: "homepath"},
		&cli.StringFlag{Name: "configOverrides"},
	}
}

type resolvedConfigFlags struct {
	config, homepath, overrides string
}

// runWithConfigFlags mirrors `grafana cli [global flags] admin <cmd> [cmd flags]`.
// localFlags controls whether the subcommand redefines the global flags.
func runWithConfigFlags(t *testing.T, localFlags bool, args ...string) resolvedConfigFlags {
	t.Helper()

	var got resolvedConfigFlags
	sub := &cli.Command{
		Name: "cmd",
		Action: func(c *cli.Context) error {
			cmd := &ContextCommandLine{Context: c}
			got = resolvedConfigFlags{cmd.ConfigFile(), cmd.HomePath(), cmd.ConfigOverrides()}
			return nil
		},
	}
	if localFlags {
		sub.Flags = configFlags()
	}

	app := &cli.App{
		Commands: []*cli.Command{{
			Name:        "cli",
			Flags:       configFlags(),
			Subcommands: []*cli.Command{{Name: "admin", Subcommands: []*cli.Command{sub}}},
		}},
	}
	require.NoError(t, app.Run(append([]string{"grafana"}, args...)))
	return got
}

func TestContextCommandLineConfigFlags(t *testing.T) {
	tests := []struct {
		name       string
		localFlags bool
		args       []string
		want       resolvedConfigFlags
	}{
		{
			name: "global flags without local definitions",
			args: []string{"cli", "--config", "g.ini", "--homepath", "/g", "--configOverrides", "g=1", "admin", "cmd"},
			want: resolvedConfigFlags{"g.ini", "/g", "g=1"},
		},
		{
			name:       "global flags are not hidden by unset local definitions",
			localFlags: true,
			args:       []string{"cli", "--config", "g.ini", "--homepath", "/g", "--configOverrides", "g=1", "admin", "cmd"},
			want:       resolvedConfigFlags{"g.ini", "/g", "g=1"},
		},
		{
			name:       "local flags",
			localFlags: true,
			args:       []string{"cli", "admin", "cmd", "--config", "l.ini", "--homepath", "/l", "--configOverrides", "l=1"},
			want:       resolvedConfigFlags{"l.ini", "/l", "l=1"},
		},
		{
			name:       "local flags take precedence over global flags",
			localFlags: true,
			args:       []string{"cli", "--config", "g.ini", "--homepath", "/g", "admin", "cmd", "--config", "l.ini"},
			want:       resolvedConfigFlags{config: "l.ini", homepath: "/g"},
		},
		{
			name:       "no flags",
			localFlags: true,
			args:       []string{"cli", "admin", "cmd"},
			want:       resolvedConfigFlags{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, runWithConfigFlags(t, tt.localFlags, tt.args...))
		})
	}
}
