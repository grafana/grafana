package main

import (
	"fmt"
	"io"

	"github.com/urfave/cli/v2"
)

func cmdSync() *cli.Command {
	flags := []cli.Flag{
		&cli.StringFlag{Name: "remote", Value: "origin", Usage: "Git remote name"},
		&cli.StringFlag{
			Name:  "strategy",
			Value: "rebase",
			Usage: "When --apply is set: rebase | merge | ff (ff-only merge)",
		},
		&cli.BoolFlag{Name: "apply", Usage: "Perform fetch + sync; without it, only prints drift"},
		&cli.BoolFlag{Name: "oss-only", Usage: "Only consider the OSS repository"},
		&cli.BoolFlag{Name: "enterprise-only", Usage: "Only consider the enterprise repository"},
		&cli.BoolFlag{Name: "yes", Aliases: []string{"y"}, Usage: "Required together with --apply"},
	}

	return &cli.Command{
		Name:  "sync",
		Usage: "Detect drift against the remote default branch; optionally rebase or merge",
		Flags: flags,
		Action: func(c *cli.Context) error {
			p, err := mustResolve(c)
			if err != nil {
				return err
			}
			if c.Bool("apply") && !c.Bool("yes") {
				return fmt.Errorf("refusing: --apply requires --yes")
			}
			remote := c.String("remote")
			ossOnly := c.Bool("oss-only")
			entOnly := c.Bool("enterprise-only")
			if ossOnly && entOnly {
				return fmt.Errorf("choose at most one of --oss-only and --enterprise-only")
			}
			w := c.App.Writer
			if !ossOnly {
				if err := reportAndMaybeSyncRepo(p.Enterprise, remote, "enterprise", c, w); err != nil {
					return err
				}
			}
			if !entOnly {
				if err := reportAndMaybeSyncRepo(p.OSS, remote, "OSS", c, w); err != nil {
					return err
				}
			}
			return nil
		},
	}
}

func reportAndMaybeSyncRepo(dir, remote, label string, c *cli.Context, w io.Writer) error {
	base, err := remoteDefaultBranch(dir, remote)
	if err != nil {
		return fmt.Errorf("%s: %w", label, err)
	}
	if _, err := git(dir, "fetch", remote); err != nil {
		return fmt.Errorf("%s: %w", label, err)
	}
	ref := fmt.Sprintf("%s/%s", remote, base)
	behind, ahead, err := commitsRelativeToRef(dir, ref)
	if err != nil {
		return fmt.Errorf("%s: %w", label, err)
	}
	_, _ = fmt.Fprintf(w, "%s: branch vs %s — behind=%d ahead=%d\n", label, ref, behind, ahead)
	if !c.Bool("apply") {
		return nil
	}
	if behind == 0 {
		_, _ = fmt.Fprintf(w, "%s: nothing to sync (already contains %s)\n", label, ref)
		return nil
	}
	strategy := c.String("strategy")
	switch strategy {
	case "rebase":
		if _, err := git(dir, "rebase", ref); err != nil {
			return fmt.Errorf("%s: rebase: %w", label, err)
		}
	case "merge":
		if _, err := git(dir, "merge", ref); err != nil {
			return fmt.Errorf("%s: merge: %w", label, err)
		}
	case "ff":
		if _, err := git(dir, "merge", "--ff-only", ref); err != nil {
			return fmt.Errorf("%s: ff-only merge: %w", label, err)
		}
	default:
		return fmt.Errorf("unknown strategy %q (use rebase, merge, or ff)", strategy)
	}
	_, _ = fmt.Fprintf(w, "%s: sync complete (%s onto %s)\n", label, strategy, ref)
	return nil
}
