package commands

import (
	"os"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

func (e *Executor) initCompletion() {
	completionCmd := &cobra.Command{
		Use:   "completion",
		Short: "Output completion script",
	}
	e.rootCmd.AddCommand(completionCmd)

	bashCmd := &cobra.Command{
		Use:   "bash",
		Short: "Output bash completion script",
		RunE:  e.executeCompletion,
	}
	completionCmd.AddCommand(bashCmd)
}

func (e *Executor) executeCompletion(cmd *cobra.Command, args []string) error {
	err := cmd.Root().GenBashCompletion(os.Stdout)
	if err != nil {
		return errors.Wrap(err, "unable to generate bash completions: %v")
	}

	return nil
}
