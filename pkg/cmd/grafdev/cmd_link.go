package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/urfave/cli/v2"
)

func cmdLink() *cli.Command {
	return &cli.Command{
		Name:  "link",
		Usage: "Inspect or invoke the enterprise ↔ OSS dev link (make enterprise-dev / unlock)",
		Subcommands: []*cli.Command{
			{
				Name:  "status",
				Usage: "Show how enterprise-dev is wired (from local/Makefile) and .devlock state",
				Action: func(c *cli.Context) error {
					p, err := mustResolve(c)
					if err != nil {
						return err
					}
					w := c.App.Writer
					_, _ = fmt.Fprintf(w, "OSS:         %s\n", p.OSS)
					_, _ = fmt.Fprintf(w, "Enterprise:  %s\n", p.Enterprise)
					_, _ = fmt.Fprintf(w, "Dev script:  %s\n", filepath.Join(p.Enterprise, "start-dev.sh"))
					lock := p.EnterpriseDevLock()
					if _, err := os.Stat(lock); err == nil {
						_, _ = fmt.Fprintf(w, ".devlock:    present (%s) — watcher likely running or stale\n", lock)
					} else {
						_, _ = fmt.Fprintf(w, ".devlock:    absent\n")
					}
					if data, err := os.ReadFile(p.LocalMakefile()); err == nil {
						if strings.Contains(string(data), "enterprise-dev:") {
							_, _ = fmt.Fprintln(w, "Makefile:    local/Makefile defines enterprise-dev (expected)")
						}
					} else {
						_, _ = fmt.Fprintf(w, "Makefile:    local/Makefile not readable: %v\n", err)
					}
					_, _ = fmt.Fprintln(w, "\nTypical flow: from OSS repo, run: make enterprise-dev")
					_, _ = fmt.Fprintln(w, "That runs start-dev.sh which copies enterprise→OSS then watches OSS paths and runs oss-to-enterprise.sh on change.")
					return nil
				},
			},
			{
				Name:  "start",
				Usage: "Run `make enterprise-dev` in the OSS tree (foreground; Ctrl+C stops watcher and remove-enterprise runs via trap)",
				Flags: []cli.Flag{
					&cli.BoolFlag{Name: "dry-run", Usage: "Print make -n enterprise-dev instead of running"},
				},
				Action: func(c *cli.Context) error {
					p, err := mustResolve(c)
					if err != nil {
						return err
					}
					makeBin, err := exec.LookPath("make")
					if err != nil {
						return err
					}
					args := []string{"enterprise-dev"}
					if c.Bool("dry-run") {
						args = []string{"-n", "enterprise-dev"}
					}
					cmd := exec.Command(makeBin, args...)
					cmd.Dir = p.OSS
					cmd.Stdin = os.Stdin
					cmd.Stdout = os.Stdout
					cmd.Stderr = os.Stderr
					return cmd.Run()
				},
			},
			{
				Name:  "unlock",
				Usage: "Remove stale ../grafana-enterprise/.devlock (same as make enterprise-unlock when local/Makefile exists)",
				Action: func(c *cli.Context) error {
					p, err := mustResolve(c)
					if err != nil {
						return err
					}
					lock := p.EnterpriseDevLock()
					if err := os.Remove(lock); err != nil {
						if os.IsNotExist(err) {
							_, _ = fmt.Fprintf(c.App.Writer, "no lock at %s\n", lock)
							return nil
						}
						return err
					}
					_, _ = fmt.Fprintf(c.App.Writer, "removed %s\n", lock)
					return nil
				},
			},
		},
	}
}
