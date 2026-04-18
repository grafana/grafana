package main

import (
	"fmt"

	"github.com/urfave/cli/v2"
)

func cmdContext() *cli.Command {
	return &cli.Command{
		Name:  "context",
		Usage: "Print resolved repo paths and current git branches",
		Action: func(c *cli.Context) error {
			p, err := mustResolve(c)
			if err != nil {
				return err
			}
			fmt.Fprintf(c.App.Writer, "OSS root:        %s\n", p.OSS)
			fmt.Fprintf(c.App.Writer, "Enterprise root: %s\n", p.Enterprise)
			ossBr, ossErr := currentBranch(p.OSS)
			entBr, entErr := currentBranch(p.Enterprise)
			if ossErr == nil {
				fmt.Fprintf(c.App.Writer, "OSS branch:      %s\n", ossBr)
			} else {
				fmt.Fprintf(c.App.Writer, "OSS branch:      (not a git repo? %v)\n", ossErr)
			}
			if entErr == nil {
				fmt.Fprintf(c.App.Writer, "GE branch:       %s\n", entBr)
			} else {
				fmt.Fprintf(c.App.Writer, "GE branch:       (not a git repo? %v)\n", entErr)
			}
			return nil
		},
	}
}
