package main

import (
	"fmt"
	"io"
	"strings"

	"github.com/urfave/cli/v2"
)

func cmdBranch() *cli.Command {
	return &cli.Command{
		Name:  "branch",
		Usage: "Create a fresh branch from the remote default branch",
		Subcommands: []*cli.Command{
			{
				Name:      "enterprise",
				Usage:     "Create <name> on grafana-enterprise only (from origin default branch)",
				ArgsUsage: "<name>",
				Flags: []cli.Flag{
					&cli.StringFlag{Name: "remote", Value: "origin", Usage: "Git remote name"},
					&cli.BoolFlag{Name: "yes", Aliases: []string{"y"}, Usage: "Non-interactive"},
					&cli.BoolFlag{Name: "reset-existing", Usage: "If the branch already exists locally, reset it to remote default (git switch -C); default is refuse"},
				},
				Action: func(c *cli.Context) error {
					name := strings.TrimSpace(c.Args().First())
					if name == "" {
						return fmt.Errorf("branch name is required")
					}
					p, err := mustResolve(c)
					if err != nil {
						return err
					}
					return createBranchFromRemoteDefault(p.Enterprise, c.String("remote"), name, c.Bool("yes"), c.Bool("reset-existing"), c.App.ErrWriter)
				},
			},
			{
				Name:      "dual",
				Usage:     "Create the same branch name on OSS and enterprise from each repo's origin default branch",
				ArgsUsage: "<name>",
				Flags: []cli.Flag{
					&cli.StringFlag{Name: "remote", Value: "origin", Usage: "Git remote name"},
					&cli.BoolFlag{Name: "yes", Aliases: []string{"y"}, Usage: "Non-interactive"},
					&cli.BoolFlag{Name: "reset-existing", Usage: "If the branch already exists locally, reset it to remote default (git switch -C); default is refuse"},
				},
				Action: func(c *cli.Context) error {
					name := strings.TrimSpace(c.Args().First())
					if name == "" {
						return fmt.Errorf("branch name is required")
					}
					p, err := mustResolve(c)
					if err != nil {
						return err
					}
					if err := createBranchFromRemoteDefault(p.OSS, c.String("remote"), name, c.Bool("yes"), c.Bool("reset-existing"), c.App.ErrWriter); err != nil {
						return err
					}
					return createBranchFromRemoteDefault(p.Enterprise, c.String("remote"), name, c.Bool("yes"), c.Bool("reset-existing"), c.App.ErrWriter)
				},
			},
		},
	}
}

func createBranchFromRemoteDefault(dir, remote, branch string, yes, resetExisting bool, w io.Writer) error {
	if !yes {
		return fmt.Errorf("refusing without --yes: would run git fetch and create (or with --reset-existing, reset) branch %q in %s", branch, dir)
	}
	base, err := remoteDefaultBranch(dir, remote)
	if err != nil {
		return err
	}
	if _, err := git(dir, "fetch", remote); err != nil {
		return err
	}
	ref := fmt.Sprintf("%s/%s", remote, base)
	return switchToBranchFromRef(dir, branch, ref, resetExisting, w)
}
