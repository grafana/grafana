package main

import (
	"fmt"
	"io"

	"github.com/urfave/cli/v2"
)

func cmdDualize() *cli.Command {
	return &cli.Command{
		Name:  "dualize",
		Usage: "Align grafana-enterprise branch with OSS (or the reverse) for dual-repo work",
		Description: `Typical flows:
  - OSS is on feature/foo and enterprise is still on the remote default branch: creates feature/foo on enterprise from origin/<default>.
  - Enterprise is on feature/foo and OSS is still on the remote default branch: creates feature/foo on OSS from origin/<default>.
If both repos already use the same branch name, this command succeeds as a no-op.

Requires a clean working tree unless --force is passed (still refuses if there are untracked conflict risks — only bypasses dirty check).`,
		Flags: []cli.Flag{
			&cli.StringFlag{Name: "remote", Value: "origin", Usage: "Git remote name"},
			&cli.BoolFlag{Name: "yes", Aliases: []string{"y"}, Usage: "Required to perform git operations"},
			&cli.BoolFlag{Name: "force", Usage: "Allow dirty working trees (use with care)"},
		},
		Action: func(c *cli.Context) error {
			p, err := mustResolve(c)
			if err != nil {
				return err
			}
			if !c.Bool("yes") {
				return fmt.Errorf("refusing without --yes: dualize runs git fetch/switch in OSS and/or enterprise checkouts")
			}
			return dualize(p, c.String("remote"), c.Bool("force"), c.App.ErrWriter)
		},
	}
}

func dualize(p RepoPaths, remote string, force bool, logW io.Writer) error {
	ossBr, err := currentBranch(p.OSS)
	if err != nil {
		return fmt.Errorf("OSS: %w", err)
	}
	geBr, err := currentBranch(p.Enterprise)
	if err != nil {
		return fmt.Errorf("enterprise: %w", err)
	}
	if !force {
		for _, x := range []struct {
			dir, name string
		}{
			{p.OSS, "OSS"},
			{p.Enterprise, "enterprise"},
		} {
			clean, err := isCleanWorktree(x.dir)
			if err != nil {
				return err
			}
			if !clean {
				return fmt.Errorf("%s repo %s has a dirty working tree; commit/stash or pass --force", x.name, x.dir)
			}
		}
	}
	if ossBr == geBr {
		_, _ = fmt.Fprintf(logW, "Already dualized: both on branch %q\n", ossBr)
		return nil
	}
	ossBase, err := remoteDefaultBranch(p.OSS, remote)
	if err != nil {
		return err
	}
	geBase, err := remoteDefaultBranch(p.Enterprise, remote)
	if err != nil {
		return err
	}
	ossRef := fmt.Sprintf("%s/%s", remote, ossBase)
	geRef := fmt.Sprintf("%s/%s", remote, geBase)

	switch {
	case ossBr != ossBase && geBr == geBase:
		if _, err := git(p.Enterprise, "fetch", remote); err != nil {
			return err
		}
		if _, err := git(p.Enterprise, "switch", "-C", ossBr, geRef); err != nil {
			return err
		}
		_, _ = fmt.Fprintf(logW, "enterprise: created/reset branch %q from %s (OSS was already on it)\n", ossBr, geRef)
		return nil
	case geBr != geBase && ossBr == ossBase:
		if _, err := git(p.OSS, "fetch", remote); err != nil {
			return err
		}
		if _, err := git(p.OSS, "switch", "-C", geBr, ossRef); err != nil {
			return err
		}
		_, _ = fmt.Fprintf(logW, "OSS: created/reset branch %q from %s (enterprise was already on it)\n", geBr, ossRef)
		return nil
	default:
		return fmt.Errorf("ambiguous state (OSS=%q enterprise=%q): put one repo on its remote default branch or matching names first, or use grafdev branch dual",
			ossBr, geBr)
	}
}
