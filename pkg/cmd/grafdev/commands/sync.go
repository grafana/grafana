package commands

import (
	"fmt"
	"io"

	"github.com/grafana/grafana/pkg/cmd/grafdev/base"
	"github.com/urfave/cli/v2"
)

func (d Deps) cmdSync() *cli.Command {
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
		&cli.BoolFlag{Name: "force", Usage: "With --apply: allow a dirty working tree (otherwise sync refuses)"},
	}

	return &cli.Command{
		Name:  "sync",
		Usage: "Detect drift against the remote default branch; optionally rebase or merge",
		Flags: flags,
		Action: func(c *cli.Context) error {
			p, err := d.mustResolve(c)
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
			if c.Bool("apply") && c.Bool("yes") && !c.Bool("force") {
				if err := assertCleanForSync(p, ossOnly, entOnly); err != nil {
					return err
				}
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

func assertCleanForSync(p base.RepoPaths, ossOnly, entOnly bool) error {
	check := func(dir, name string) error {
		clean, err := base.IsCleanWorktree(dir)
		if err != nil {
			return fmt.Errorf("%s: %w", name, err)
		}
		if !clean {
			return fmt.Errorf("%s repo %s has a dirty working tree; commit/stash or pass --force", name, dir)
		}
		return nil
	}
	if !ossOnly {
		if err := check(p.Enterprise, "enterprise"); err != nil {
			return err
		}
	}
	if !entOnly {
		if err := check(p.OSS, "OSS"); err != nil {
			return err
		}
	}
	return nil
}

func reportAndMaybeSyncRepo(dir, remote, label string, c *cli.Context, w io.Writer) error {
	refBase, err := base.RemoteDefaultBranch(dir, remote)
	if err != nil {
		return fmt.Errorf("%s: %w", label, err)
	}
	if _, err := base.Git(dir, "fetch", remote); err != nil {
		return fmt.Errorf("%s: %w", label, err)
	}
	ref := fmt.Sprintf("%s/%s", remote, refBase)
	behind, ahead, err := base.CommitsRelativeToRef(dir, ref)
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
		if _, err := base.Git(dir, "rebase", ref); err != nil {
			return fmt.Errorf("%s: rebase: %w", label, err)
		}
	case "merge":
		if _, err := base.Git(dir, "merge", ref); err != nil {
			return fmt.Errorf("%s: merge: %w", label, err)
		}
	case "ff":
		if _, err := base.Git(dir, "merge", "--ff-only", ref); err != nil {
			return fmt.Errorf("%s: ff-only merge: %w", label, err)
		}
	default:
		return fmt.Errorf("unknown strategy %q (use rebase, merge, or ff)", strategy)
	}
	_, _ = fmt.Fprintf(w, "%s: sync complete (%s onto %s)\n", label, strategy, ref)
	return nil
}
