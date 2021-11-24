package commands

import (
	"strings"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/datamigrations"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/secretsmigrations"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/urfave/cli/v2"
)

func runRunnerCommand(command func(commandLine utils.CommandLine, runner runner.Runner) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}

		cfg, err := initCfg(cmd)
		if err != nil {
			return errutil.Wrap("failed to load configuration", err)
		}

		r, err := runner.Initialize(cfg)
		if err != nil {
			return errutil.Wrap("failed to initialize runner", err)
		}

		if err := command(cmd, r); err != nil {
			return err
		}

		logger.Info("\n\n")
		return nil
	}
}

func runDbCommand(command func(commandLine utils.CommandLine, sqlStore *sqlstore.SQLStore) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}

		cfg, err := initCfg(cmd)
		if err != nil {
			return errutil.Wrap("failed to load configuration", err)
		}

		sqlStore, err := sqlstore.ProvideService(cfg, nil, bus.GetBus(), &migrations.OSSMigrations{})
		if err != nil {
			return errutil.Wrap("failed to initialize SQL store", err)
		}

		if err := command(cmd, sqlStore); err != nil {
			return err
		}

		logger.Info("\n\n")
		return nil
	}
}

func initCfg(cmd *utils.ContextCommandLine) (*setting.Cfg, error) {
	configOptions := strings.Split(cmd.String("configOverrides"), " ")
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   cmd.ConfigFile(),
		HomePath: cmd.HomePath(),
		Args:     append(configOptions, cmd.Args().Slice()...), // tailing arguments have precedence over the options string
	})

	if err != nil {
		return nil, err
	}

	if cmd.Bool("debug") {
		cfg.LogConfigSources()
	}

	return cfg, nil
}

func runPluginCommand(command func(commandLine utils.CommandLine) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		if err := command(cmd); err != nil {
			return err
		}

		logger.Info(color.GreenString("Please restart Grafana after installing plugins. Refer to Grafana documentation for instructions if necessary.\n\n"))
		return nil
	}
}

func runCueCommand(command func(commandLine utils.CommandLine) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		return command(&utils.ContextCommandLine{Context: context})
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
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:  "password-from-stdin",
				Usage: "Read the password from stdin",
				Value: false,
			},
		},
	},
	{
		Name:  "data-migration",
		Usage: "Runs a script that migrates or cleanups data in your database",
		Subcommands: []*cli.Command{
			{
				Name:   "encrypt-datasource-passwords",
				Usage:  "Migrates passwords from unsecured fields to secure_json_data field. Return ok unless there is an error. Safe to execute multiple times.",
				Action: runDbCommand(datamigrations.EncryptDatasourcePasswords),
			},
		},
	},
	{
		Name:  "secrets-migration",
		Usage: "Runs a script that migrates secrets in your database",
		Subcommands: []*cli.Command{
			{
				Name:   "re-encrypt",
				Usage:  "Re-encrypts secrets by decrypting and re-encrypting them with the currently configured encryption. Returns ok unless there is an error. Safe to execute multiple times.",
				Action: runRunnerCommand(secretsmigrations.ReEncryptSecrets),
			},
		},
	},
}

var cueCommands = []*cli.Command{
	{
		Name:   "validate-schema",
		Usage:  "validate known *.cue files in the Grafana project",
		Action: runCueCommand(cmd.validateScuemata),
		Description: `validate-schema checks that all CUE schema files are valid with respect
to basic standards - valid CUE, valid scuemata, etc. Note that this
command checks only paths that existed when grafana-cli was compiled,
so must be recompiled to validate newly-added CUE files.`,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "grafana-root",
				Usage: "path to the root of a Grafana repository to validate",
			},
		},
	},
	{
		Name:   "validate-resource",
		Usage:  "validate resource files (e.g. dashboard JSON) against schema",
		Action: runCueCommand(cmd.validateResources),
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "dashboard",
				Usage: "dashboard JSON file to validate",
			},
			&cli.BoolFlag{
				Name:  "base-only",
				Usage: "validate using only base schema, not dist (includes plugin schema)",
				Value: false,
			},
		},
	},
	{
		Name:   "trim-resource",
		Usage:  "trim schema-specified defaults from a resource",
		Action: runCueCommand(cmd.trimResource),
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "dashboard",
				Usage: "path to file containing (valid) dashboard JSON",
			},
			&cli.BoolFlag{
				Name:  "apply",
				Usage: "invert the operation: apply defaults instead of trimming them",
				Value: false,
			},
		},
	},
	{
		Name:  "gen-ts",
		Usage: "generate TypeScript from all known CUE file types",
		Description: `gen-ts generates TypeScript from all CUE files at
		expected positions in the filesystem tree of a Grafana repository.`,
		Action: runCueCommand(cmd.generateTypescript),
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "grafana-root",
				Usage: "path to the root of a Grafana repository in which to generate TypeScript from CUE files",
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
	{
		Name:        "cue",
		Usage:       "Cue validation commands",
		Subcommands: cueCommands,
	},
}
