package commands

import (
	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	"os"
)

func runCommand(command func(commandLine CommandLine) error) func(context *cli.Context) {
	return func(context *cli.Context) {

		cmd := &contextCommandLine{context}
		if err := command(cmd); err != nil {
			log.Errorf("%v\n\n", err)

			cmd.ShowHelp()
			os.Exit(1)
		} else {
			log.Info("\nRestart grafana after installing plugins . <service grafana-server restart>\n\n")
		}
	}
}

var Commands = []cli.Command{
	{
		Name:   "install",
		Usage:  "install <plugin name>",
		Action: runCommand(installCommand),
	}, {
		Name:   "list-remote",
		Usage:  "list remote available plugins",
		Action: runCommand(listremoteCommand),
	}, {
		Name:   "upgrade",
		Usage:  "upgrade <plugin name>",
		Action: runCommand(upgradeCommand),
	}, {
		Name:   "upgrade-all",
		Usage:  "upgrades all your installed plugins",
		Action: runCommand(upgradeAllCommand),
	}, {
		Name:   "ls",
		Usage:  "list all installed plugins",
		Action: runCommand(lsCommand),
	}, {
		Name:   "remove",
		Usage:  "remove <plugin name>",
		Action: runCommand(removeCommand),
	},
}
