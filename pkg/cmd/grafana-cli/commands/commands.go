package commands

import (
	"os"

	"github.com/codegangsta/cli"
	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
)

func runCommand(command func(commandLine CommandLine) error) func(context *cli.Context) {
	return func(context *cli.Context) {

		cmd := &contextCommandLine{context}
		if err := command(cmd); err != nil {
			logger.Errorf("\n%s: ", color.RedString("Error"))
			logger.Errorf("%s\n\n", err)

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
		Action: runCommand(installCommand),
	}, {
		Name:   "list-remote",
		Usage:  "list remote available plugins",
		Action: runCommand(listremoteCommand),
	}, {
		Name:   "list-versions",
		Usage:  "list-versions <plugin id>",
		Action: runCommand(listversionsCommand),
	}, {
		Name:    "update",
		Usage:   "update <plugin id>",
		Aliases: []string{"upgrade"},
		Action:  runCommand(upgradeCommand),
	}, {
		Name:    "update-all",
		Aliases: []string{"upgrade-all"},
		Usage:   "update all your installed plugins",
		Action:  runCommand(upgradeAllCommand),
	}, {
		Name:   "ls",
		Usage:  "list all installed plugins",
		Action: runCommand(lsCommand),
	}, {
		Name:    "uninstall",
		Aliases: []string{"remove"},
		Usage:   "uninstall <plugin id>",
		Action:  runCommand(removeCommand),
	},
}

var Commands = []cli.Command{
	{
		Name:        "plugins",
		Usage:       "Manage plugins for grafana",
		Subcommands: pluginCommands,
	},
}
