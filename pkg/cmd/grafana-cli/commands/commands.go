package commands

import (
	"os"

	"github.com/codegangsta/cli"
	"github.com/wangy1931/grafana/pkg/cmd/grafana-cli/log"
)

func runCommand(command func(commandLine CommandLine) error) func(context *cli.Context) {
	return func(context *cli.Context) {

		cmd := &contextCommandLine{context}
		if err := command(cmd); err != nil {
			log.Error("\nError: ")
			log.Errorf("%s\n\n", err)

			cmd.ShowHelp()
			os.Exit(1)
		} else {
			log.Info("\nRestart grafana after installing plugins . <service grafana-server restart>\n\n")
		}
	}
}

var pluginCommands = []cli.Command{
	{
		Name:   "install",
		Usage:  "install <plugin id>",
		Action: runCommand(installCommand),
	}, {
		Name:   "list-remote",
		Usage:  "list remote available plugins",
		Action: runCommand(listremoteCommand),
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
		Name:   "uninstall",
		Usage:  "uninstall <plugin id>",
		Action: runCommand(removeCommand),
	}, {
		Name:   "remove",
		Usage:  "remove <plugin id>",
		Action: runCommand(removeCommand),
	},
}

var Commands = []cli.Command{
	{
		Name:        "plugins",
		Usage:       "Manage plugins for grafana",
		Subcommands: pluginCommands,
	},
}
