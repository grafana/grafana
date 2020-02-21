package commands

import (
	"os"
	"strings"

	"fmt"
	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/datamigrations"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/urfave/cli/v2"
)

func runDbCommand(command func(commandLine utils.CommandLine, sqlStore *sqlstore.SqlStore) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		debug := cmd.Bool("debug")

		cfg := setting.NewCfg()

		configOptions := strings.Split(cmd.String("configOverrides"), " ")
		// Here we have to translate cmd.Args() to a list of strings
		if err := cfg.Load(&setting.CommandLineArgs{
			Config:   cmd.ConfigFile(),
			HomePath: cmd.HomePath(),
			Args:     append(configOptions, cmd.Args().Slice()...), // tailing arguments have precedence over the options string
		}); err != nil {
			return fmt.Errorf("\n%s: Failed to load configuration", color.RedString("Error"))
		}

		if debug {
			cfg.LogConfigSources()
		}

		engine := &sqlstore.SqlStore{}
		engine.Cfg = cfg
		engine.Bus = bus.GetBus()
		if err := engine.Init(); err != nil {
			return fmt.Errorf("\n%s: Failed to initialize SQL engine", color.RedString("Error"))
		}

		if err := command(cmd, engine); err != nil {
			return err
			os.Exit(1)
		}

		logger.Info("\n\n")
		return nil
	}
}

func runPluginCommand(command func(commandLine utils.CommandLine) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		if err := command(cmd); err != nil {
			// TODO: Figure out if it's still necessary to print on error
			logger.Errorf("\n%s: ", color.RedString("Error"))
			logger.Errorf("%s %s\n\n", color.RedString("✗"), err)

			if err := cmd.ShowHelp(); err != nil {
				logger.Errorf("\n%s: Failed to show help: %s %s\n\n", color.RedString("Error"),
					color.RedString("✗"), err)
			}

			return err
		}

		logger.Info("\nRestart grafana after installing plugins . <service grafana-server restart>\n\n")
		return nil
	}
}

var pluginCommands = []*cli.Command{
	{
		Name:   "install",
		Usage:  "install <plugin id> <plugin version (optional)>",
		Action: runPluginCommand(installCommand),
	}, {
		Name:   "list-remote",
		Usage:  "list remote available plugins",
		Action: runPluginCommand(listRemoteCommand),
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

var adminCommands = []*cli.Command{
	{
		Name:   "reset-admin-password",
		Usage:  "reset-admin-password <new password>",
		Action: runDbCommand(resetPasswordCommand),
	},
	{
		Name:  "data-migration",
		Usage: "Runs a script that migrates or cleanups data in your db",
		Subcommands: []*cli.Command{
			{
				Name:   "encrypt-datasource-passwords",
				Usage:  "Migrates passwords from unsecured fields to secure_json_data field. Return ok unless there is an error. Safe to execute multiple times.",
				Action: runDbCommand(datamigrations.EncryptDatasourcePaswords),
			},
		},
	},
}

var Commands = []*cli.Command{
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
