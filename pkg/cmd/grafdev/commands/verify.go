package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/cmd/grafdev/base"
	"github.com/urfave/cli/v2"
)

func (d Deps) cmdVerify() *cli.Command {
	return &cli.Command{
		Name:  "verify",
		Usage: "Exit 0 only if OSS + enterprise checkouts, local/Makefile, and ext.go look usable",
		Description: `Fast layout gate for scripts. For a fuller read-only picture (branches, drift, dev lock),
use "grafdev doctor"—ideally before mutating git (branch, dualize, sync --apply, ge git).`,
		Action: func(c *cli.Context) error {
			p, err := d.mustResolve(c)
			if err != nil {
				return err
			}
			if err := VerifyLayout(p); err != nil {
				return err
			}
			_, _ = fmt.Fprintln(c.App.Writer, "verify: ok")
			return nil
		},
	}
}

// VerifyLayout checks enterprise link prerequisites (also used by smoke).
func VerifyLayout(p base.RepoPaths) error {
	if st, e := os.Stat(p.Enterprise); e != nil || !st.IsDir() {
		return fmt.Errorf("enterprise directory missing: %s", p.Enterprise)
	}
	if _, e := os.Stat(filepath.Join(p.Enterprise, ".git")); e != nil {
		return fmt.Errorf("enterprise path is not a git checkout: %s", p.Enterprise)
	}
	if _, e := os.Stat(p.LocalMakefile()); e != nil {
		return fmt.Errorf("local/Makefile missing (no enterprise-dev target): %w", e)
	}
	b, e := os.ReadFile(p.ExtGo())
	if e != nil {
		return fmt.Errorf("ext.go: %w", e)
	}
	if !base.ExtGoIndicatesEnterpriseLinked(b) {
		return fmt.Errorf("ext.go does not appear to set IsEnterprise = true (enterprise not linked?)")
	}
	return nil
}
