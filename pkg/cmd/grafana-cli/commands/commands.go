package commands

import (
	"flag"
	"os"

	"github.com/codegangsta/cli"
	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func runDbCommand(command func(commandLine CommandLine) error) func(context *cli.Context) {
	return func(context *cli.Context) {
		cmd := &contextCommandLine{context}

		cfg := setting.NewCfg()
		cfg.Load(&setting.CommandLineArgs{
			Config:   cmd.String("config"),
			HomePath: cmd.String("homepath"),
			Args:     flag.Args(),
		})

		engine := &sqlstore.SqlStore{}
		engine.Cfg = cfg
		engine.Init()

		if err := command(cmd); err != nil {
			logger.Errorf("\n%s: ", color.RedString("Error"))
			logger.Errorf("%s\n\n", err)

			cmd.ShowHelp()
			os.Exit(1)
		} else {
			logger.Info("\n\n")
		}
	}
}

func runPluginCommand(command func(commandLine CommandLine) error) func(context *cli.Context) {
	return func(context *cli.Context) {

		cmd := &contextCommandLine{context}
		if err := command(cmd); err != nil {
			logger.Errorf("\n%s: ", color.RedString("Error"))
			logger.Errorf("%s %s\n\n", color.RedString("✗"), err)

			cmd.ShowHelp()
			os.Exit(1)
		} else {
			logger.Info("\nRestart grafana after installing plugins . <service grafana-server restart>\n\n")
		}
	}
}

var pluginCommands = []cli.Command{
	{
		Name:   "install",
		Usage:  "install <plugin id> <plugin version (optional)>",
		Action: runPluginCommand(installCommand),
	}, {
		Name:   "list-remote",
		Usage:  "list remote available plugins",
		Action: runPluginCommand(listremoteCommand),
	}, {
		Name:   "list-versions",
		Usage:  "list-versions <plugin id>",
		Action: runPluginCommand(listversionsCommand),
	}, {
		Name:    "update",
		Usage:   "update <plugin id>",
		Aliases: []string{"upgrade"},
		Action:  runPluginCommand(upgradeCommand),
	}, {
		Name:    "update-all",
		Aliases: []string{"upgrade-all"},
		Usage:   "update all your installed plugins",
		Action:  runPluginCommand(upgradeAllCommand),
	}, {
		Name:   "ls",
		Usage:  "list all installed plugins",
		Action: runPluginCommand(lsCommand),
	}, {
		Name:    "uninstall",
		Aliases: []string{"remove"},
		Usage:   "uninstall <plugin id>",
		Action:  runPluginCommand(removeCommand),
	},
}

var adminCommands = []cli.Command{
	{
		Name:   "reset-admin-password",
		Usage:  "reset-admin-password <new password>",
		Action: runDbCommand(resetPasswordCommand),
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "homepath",
				Usage: "path to grafana install/home path, defaults to working directory",
			},
			cli.StringFlag{
				Name:  "config",
				Usage: "path to config file",
			},
		},
	},
}

var Commands = []cli.Command{
	{
		Name:        "plugins",
		Usage:       "Manage plugins for grafana",
		Subcommands: pluginCommands,
	},
	{
		Name:        "admin",
		Usage:       "Grafana admin commands",
		Subcommands: adminCommands,
	},
}
