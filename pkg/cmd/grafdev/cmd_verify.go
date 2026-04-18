package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"

	"github.com/urfave/cli/v2"
)

// cmdVerify is a minimal non-zero exit gate for scripting (CI / preflight).
func cmdVerify() *cli.Command {
	return &cli.Command{
		Name:  "verify",
		Usage: "Exit 0 only if OSS + enterprise checkouts, local/Makefile, and ext.go look usable",
		Action: func(c *cli.Context) error {
			p, err := mustResolve(c)
			if err != nil {
				return err
			}
			if err := verifyLayout(p); err != nil {
				return err
			}
			_, _ = fmt.Fprintln(c.App.Writer, "verify: ok")
			return nil
		},
	}
}

func verifyLayout(p RepoPaths) error {
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
	if !bytes.Contains(b, []byte("IsEnterprise = true")) {
		return fmt.Errorf("ext.go does not contain IsEnterprise = true")
	}
	return nil
}
