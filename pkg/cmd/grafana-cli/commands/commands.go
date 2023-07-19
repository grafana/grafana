package commands

import (
	"fmt"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/datamigrations"
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
		runner, err := initializeRunner(cmd)
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

func runDbCommand(command func(commandLine utils.CommandLine, sqlStore db.DB) error) func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		runner, err := initializeRunner(cmd)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize runner", err)
		}

		sqlStore := runner.SQLStore
		if err := command(cmd, sqlStore); err != nil {
			return err
		}

		logger.Info("\n\n")
		return nil
	}
}

func initializeRunner(cmd *utils.ContextCommandLine) (server.Runner, error) {
	configOptions := strings.Split(cmd.String("configOverrides"), " ")
	runner, err := server.InitializeForCLI(setting.CommandLineArgs{
		Config:   cmd.ConfigFile(),
		HomePath: cmd.HomePath(),
		// tailing arguments have precedence over the options string
		Args: append(configOptions, cmd.Args().Slice()...),
	})
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
		Name:  "user-manager",
		Usage: "Runs different helpful user commands",
		Subcommands: []*cli.Command{
			// TODO: reset password for user
			{
				Name:  "conflicts",
				Usage: "runs a conflict resolution to find users with multiple entries",
				CustomHelpTemplate: `
This command will find users with multiple entries in the database and try to resolve the conflicts.
explanation of each field:

explanation of each field:
* email - the user’s email
* login - the user’s login/username
* last_seen_at - the user’s last login
* auth_module - if the user was created/signed in using an authentication provider
* conflict_email - a boolean if we consider the email to be a conflict
* conflict_login - a boolean if we consider the login to be a conflict

# lists all the conflicting users
grafana-cli user-manager conflicts list

# creates a conflict patch file to edit
grafana-cli user-manager conflicts generate-file

# reads edited conflict patch file for validation
grafana-cli user-manager conflicts validate-file <filepath>

# validates and ingests edited patch file
grafana-cli user-manager conflicts ingest-file <filepath>
`,
				Subcommands: []*cli.Command{
					{
						Name:   "list",
						Usage:  "returns a list of users with more than one entry in the database",
						Action: runListConflictUsers(),
					},
					{
						Name:   "generate-file",
						Usage:  "creates a conflict users file. Safe to execute multiple times.",
						Action: runGenerateConflictUsersFile(),
					},
					{
						Name:   "validate-file",
						Usage:  "validates the conflict users file. Safe to execute multiple times.",
						Action: runValidateConflictUsersFile(),
					},
					{
						Name:   "ingest-file",
						Usage:  "ingests the conflict users file. > Note: This is irreversible it will change the state of the database.",
						Action: runIngestConflictUsersFile(),
					},
				},
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
