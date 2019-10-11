package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/golangci/golangci-lint/pkg/exitcodes"
	"github.com/golangci/golangci-lint/pkg/fsutils"
)

func (e *Executor) initConfig() {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Config",
		Run: func(cmd *cobra.Command, args []string) {
			if len(args) != 0 {
				e.log.Fatalf("Usage: golangci-lint config")
			}
			if err := cmd.Help(); err != nil {
				e.log.Fatalf("Can't run help: %s", err)
			}
		},
	}
	e.rootCmd.AddCommand(cmd)

	pathCmd := &cobra.Command{
		Use:   "path",
		Short: "Print used config path",
		Run:   e.executePathCmd,
	}
	e.initRunConfiguration(pathCmd) // allow --config
	cmd.AddCommand(pathCmd)
}

func (e *Executor) executePathCmd(_ *cobra.Command, args []string) {
	if len(args) != 0 {
		e.log.Fatalf("Usage: golangci-lint config path")
	}

	usedConfigFile := viper.ConfigFileUsed()
	if usedConfigFile == "" {
		e.log.Warnf("No config file detected")
		os.Exit(exitcodes.NoConfigFileDetected)
	}

	usedConfigFile, err := fsutils.ShortestRelPath(usedConfigFile, "")
	if err != nil {
		e.log.Warnf("Can't pretty print config file path: %s", err)
	}

	fmt.Println(usedConfigFile)
	os.Exit(0)
}
