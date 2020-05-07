package commands

import (
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/datamigrations"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/urfave/cli/v2"
)

func runDbCommand(command func(commandLine utils.CommandLine, sqlStore *sqlstore.SqlStore) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		debug := cmd.Bool("debug")

		cfg := setting.NewCfg()

		configOptions := strings.Split(cmd.String("configOverrides"), " ")
		if err := cfg.Load(&setting.CommandLineArgs{
			Config:   cmd.ConfigFile(),
			HomePath: cmd.HomePath(),
			Args:     append(configOptions, cmd.Args().Slice()...), // tailing arguments have precedence over the options string
		}); err != nil {
			return errutil.Wrap("failed to load configuration", err)
		}

		if debug {
			cfg.LogConfigSources()
		}

		engine := &sqlstore.SqlStore{}
		engine.Cfg = cfg
		engine.Bus = bus.GetBus()
		if err := engine.Init(); err != nil {
			return errutil.Wrap("failed to initialize SQL engine", err)
		}

		if err := command(cmd, engine); err != nil {
			return err
		}

		logger.Info("\n\n")
		return nil
	}
}

func runPluginCommand(command func(commandLine utils.CommandLine) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		if err := command(cmd); err != nil {
			return err
		}

		logger.Info("\nRestart grafana after installing plugins . <service grafana-server restart>\n\n")
		return nil
	}
}

// Command contains command state.
type Command struct {
	Client utils.ApiClient
}

var cmd Command = Command{
	Client: &services.GrafanaComClient{},
}

var pluginCommands = []*cli.Command{
	{
		Name:   "install",
		Usage:  "install <plugin id> <plugin version (optional)>",
		Action: runPluginCommand(cmd.installCommand),
	}, {
		Name:   "list-remote",
		Usage:  "list remote available plugins",
		Action: runPluginCommand(cmd.listRemoteCommand),
	}, {
		Name:   "list-versions",
		Usage:  "list-versions <plugin id>",
		Action: runPluginCommand(cmd.listVersionsCommand),
	}, {
		Name:    "update",
		Usage:   "update <plugin id>",
		Aliases: []string{"upgrade"},
		Action:  runPluginCommand(cmd.upgradeCommand),
	}, {
		Name:    "update-all",
		Aliases: []string{"upgrade-all"},
		Usage:   "update all your installed plugins",
		Action:  runPluginCommand(cmd.upgradeAllCommand),
	}, {
		Name:   "ls",
		Usage:  "list all installed plugins",
		Action: runPluginCommand(cmd.lsCommand),
	}, {
		Name:    "uninstall",
		Aliases: []string{"remove"},
		Usage:   "uninstall <plugin id>",
		Action:  runPluginCommand(cmd.removeCommand),
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
				Action: runDbCommand(datamigrations.EncryptDatasourcePasswords),
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
