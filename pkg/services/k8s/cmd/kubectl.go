package cmd

import (
	"os"
	"path"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/urfave/cli/v2"

	k8scli "k8s.io/component-base/cli"
	"k8s.io/kubectl/pkg/cmd"
	"k8s.io/kubectl/pkg/cmd/util"

	// Import to initialize client auth plugins.
	_ "k8s.io/client-go/plugin/pkg/client/auth"
)

// CLICommand is the entrypoint for the grafana kubectl command.
func CLICommand(version string) *cli.Command {
	return &cli.Command{
		Name:            "kubectl",
		Usage:           "kubectl for grafana",
		SkipFlagParsing: true,
		UsageText:       cmd.NewDefaultKubectlCommand().UsageString(),
		Action: func(c *cli.Context) error {
			args := setting.CommandLineArgs{
				Args: []string{"cfg:log.level=error"},
			}
			cfg, err := setting.NewCfgFromArgs(args)
			if err != nil {
				return err
			}
			kubeconfigPath := path.Join(cfg.DataPath, "k8s", "grafana.kubeconfig")
			originalArgs := os.Args[2:]
			os.Args = []string{"kubectl", "--insecure-skip-tls-verify", "--kubeconfig=" + kubeconfigPath}
			os.Args = append(os.Args, originalArgs...)
			command := cmd.NewDefaultKubectlCommand()
			if err := k8scli.RunNoErrOutput(command); err != nil {
				util.CheckErr(err)
			}
			return nil
		},
	}
}
