package commands

import (
	"github.com/codegangsta/cli"
	"github.com/grafana/grafana-cli/pkg/log"
)

func runCommand(command func(commandLine CommandLine) error) func(context *cli.Context) {
	return func(context *cli.Context) {

		cmd := &contextCommandLine{context}
		if err := command(cmd); err != nil {
			log.Errorf("%v\n\n", err)

			cmd.ShowHelp()
		} else {
			log.Info("Restart grafana after installing plugins . <service grafana-server restart>\n")
		}
	}
}

var Commands = []cli.Command{
	{
		Name:   "install",
		Usage:  "installs stuff",
		Action: runCommand(installCommand),
	}, {
		Name:   "list-remote",
		Usage:  "list remote available plugins",
		Action: runCommand(listremoteCommand),
	}, {
		Name:   "upgrade",
		Usage:  "upgrades one plugin",
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
		Usage:  "removes stuff",
		Action: runCommand(removeCommand),
	},
}
