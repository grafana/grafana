package commands

import (
	"context"
	"fmt"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/datamigrations"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/secretsconsolidation"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/secretsmigrations"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

func runRunnerCommand(command func(commandLine utils.CommandLine, runner server.Runner) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		runner, err := initializeRunner(context.Context, cmd)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize runner", err)
		}
		if err := command(cmd, runner); err != nil {
			return err
		}
		logger.Info("\n\n")
		return nil
	}
}

func runDbCommand(command func(commandLine utils.CommandLine, cfg *setting.Cfg, sqlStore db.DB) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		runner, err := initializeRunner(context.Context, cmd)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize runner", err)
		}

		cfg := runner.Cfg
		sqlStore := runner.SQLStore
		if err := command(cmd, cfg, sqlStore); err != nil {
			return err
		}

		logger.Info("\n\n")
		return nil
	}
}

func initializeRunner(ctx context.Context, cmd *utils.ContextCommandLine) (server.Runner, error) {
	configOptions := strings.Split(cmd.String("configOverrides"), " ")
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   cmd.ConfigFile(),
		HomePath: cmd.HomePath(),
		// tailing arguments have precedence over the options string
		Args: append(configOptions, cmd.Args().Slice()...),
	})
	if err != nil {
		return server.Runner{}, err
	}

	runner, err := server.InitializeForCLI(ctx, cfg)
	if err != nil {
		return server.Runner{}, fmt.Errorf("%v: %w", "failed to initialize runner", err)
	}

	if cmd.Bool("debug") {
		runner.Cfg.LogConfigSources()
	}
	return runner, nil
}

func runPluginCommand(command func(commandLine utils.CommandLine) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		if err := command(cmd); err != nil {
			return err
		}
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
		Action: runPluginCommand(listVersionsCommand),
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
		Usage:  "list installed plugins (excludes core plugins)",
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
		Action: runRunnerCommand(resetPasswordCommand),
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:  "password-from-stdin",
				Usage: "Read the password from stdin",
				Value: false,
			},
			&cli.IntFlag{
				Name:  "user-id",
				Usage: "The admin user's ID",
				Value: DefaultAdminUserId,
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
			{
				Name:   "rollback",
				Usage:  "Rolls back secrets to legacy encryption. Returns ok unless there is an error. Safe to execute multiple times.",
				Action: runRunnerCommand(secretsmigrations.RollBackSecrets),
			},
			{
				Name:   "re-encrypt-data-keys",
				Usage:  "Rotates persisted data encryption keys. Returns ok unless there is an error. Safe to execute multiple times.",
				Action: runRunnerCommand(secretsmigrations.ReEncryptDEKS),
			},
		},
	},
	{
		Name:  "secrets-consolidation",
		Usage: "Runs an operation that re-encrypts all encrypted values in your database with new data keys",
		Subcommands: []*cli.Command{
			{
				Name:   "consolidate",
				Usage:  "Re-encrypts all encrypted values with new data keys and deletes the old deactivated data keys. Returns ok unless there is an error. Safe to execute multiple times.",
				Action: runRunnerCommand(secretsconsolidation.ConsolidateSecrets),
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:  "config",
						Usage: "Path to config file",
					},
					&cli.StringFlag{
						Name:  "homepath",
						Usage: "Path to Grafana install/home path, defaults to working directory",
					},
					&cli.StringFlag{
						Name:  "configOverrides",
						Usage: "Configuration options to override defaults as a string. e.g. cfg:default.paths.log=/dev/null",
					},
					&cli.IntFlag{
						Name:  "chunk-size",
						Usage: "Number of encrypted values per bulk update. Defaults to 100. Increase for fewer round-trips, decrease if hitting query size limits.",
						Value: 100,
					},
					&cli.IntFlag{
						Name:  "threads",
						Usage: "Number of parallel namespaces to consolidate. For even better performance, increase your database connections alongside this. Defaults to 1.",
						Value: 1,
					},
					&cli.BoolFlag{
						Name:  "benchmark",
						Usage: "Print duration and enable high CPU profile rate for profiling (use with --cpuprofile for bottleneck analysis)",
						Value: false,
					},
					&cli.StringFlag{
						Name:  "cpuprofile",
						Usage: "Write CPU profile to this file during consolidation (recommended: use with --benchmark for high sample rate)",
						Value: "",
					},
					&cli.StringFlag{
						Name:  "memprofile",
						Usage: "Write heap profile to this file after consolidation completes",
						Value: "",
					},
					&cli.IntFlag{
						Name:  "cpu-profile-rate",
						Usage: "CPU profile sample rate (samples per second). Default 5000; use 10000+ for high sample rate. Only applies when --cpuprofile is set.",
						Value: 5000,
					},
				},
			},
		},
	},
	{
		Name:   "flush-rbac-seed-assignment",
		Usage:  "Clears RBAC seeding to force re-seeding on next startup. Use after running an Enterprise build, then an OSS build, then an Enterprise build again.",
		Action: runDbCommand(flushSeedAssignment),
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
