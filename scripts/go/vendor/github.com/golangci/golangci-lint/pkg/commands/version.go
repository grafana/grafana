package commands

import (
	"github.com/spf13/cobra"
)

func (e *Executor) initVersion() {
	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Version",
		Run: func(cmd *cobra.Command, _ []string) {
			cmd.Printf("golangci-lint has version %s built from %s on %s\n", e.version, e.commit, e.date)
		},
	}

	e.rootCmd.AddCommand(versionCmd)
}
