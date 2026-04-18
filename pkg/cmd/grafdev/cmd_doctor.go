package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/urfave/cli/v2"
)

func cmdDoctor() *cli.Command {
	return &cli.Command{
		Name:  "doctor",
		Usage: "Sanity-check OSS + enterprise linkage, local Makefile, dev lock, and branch parity",
		Flags: []cli.Flag{
			&cli.StringFlag{Name: "remote", Value: "origin", Usage: "Git remote for drift vs default branch"},
			&cli.BoolFlag{Name: "quick-build", Usage: "Run a short enterprise-tagged compile of pkg/cmd/grafana (can take minutes)"},
			&cli.BoolFlag{Name: "strict", Usage: "Exit with non-zero status if any check warns"},
		},
		Action: func(c *cli.Context) error {
			p, err := mustResolve(c)
			if err != nil {
				return err
			}
			return runDoctor(c, p, c.String("remote"), c.Bool("quick-build"), c.Bool("strict"))
		},
	}
}

func runDoctor(c *cli.Context, p RepoPaths, remote string, quickBuild, strict bool) error {
	w := c.App.Writer
	ew := c.App.ErrWriter
	var problems int

	printCheck := func(ok bool, msg string) {
		if ok {
			_, _ = fmt.Fprintf(w, "[ok]   %s\n", msg)
		} else {
			_, _ = fmt.Fprintf(ew, "[warn] %s\n", msg)
			problems++
		}
	}

	if st, err := os.Stat(p.Enterprise); err != nil || !st.IsDir() {
		printCheck(false, fmt.Sprintf("enterprise directory missing or unreadable: %s", p.Enterprise))
	} else {
		printCheck(true, fmt.Sprintf("enterprise directory exists (%s)", p.Enterprise))
	}

	if _, err := os.Stat(filepath.Join(p.Enterprise, ".git")); err != nil {
		printCheck(false, "enterprise checkout does not look like a git repo")
	} else {
		printCheck(true, "enterprise is a git checkout")
	}

	if _, err := os.Stat(p.LocalMakefile()); err != nil {
		printCheck(false, "local/Makefile not found (enterprise-dev and tags come from -include local/Makefile)")
	} else {
		printCheck(true, "local/Makefile present (enterprise make targets available)")
	}

	if _, err := os.Stat(p.ExtGo()); err != nil {
		printCheck(false, "pkg/extensions/ext.go missing (enterprise not linked into this OSS tree?)")
	} else {
		b, _ := os.ReadFile(p.ExtGo())
		if extGoIndicatesEnterpriseLinked(b) {
			printCheck(true, "ext.go indicates enterprise extensions are linked")
		} else {
			printCheck(false, "ext.go present but IsEnterprise = true not detected")
		}
	}

	lock := p.EnterpriseDevLock()
	if _, err := os.Stat(lock); err == nil {
		active, certain := enterpriseDevLockStatus(p.OSS, p.Enterprise)
		switch {
		case active:
			printCheck(true, fmt.Sprintf(".devlock at %s (enterprise-dev watcher process detected — expected while make enterprise-dev is running)", lock))
		case certain && !active:
			printCheck(false, fmt.Sprintf(".devlock at %s but no matching watcher process — likely stale (grafdev link unlock or make enterprise-unlock)", lock))
		default:
			printCheck(true, fmt.Sprintf(".devlock at %s (could not confirm watcher via ps; if enterprise-dev is not running, remove stale lock: grafdev link unlock)", lock))
		}
	} else {
		printCheck(true, "no enterprise .devlock (nothing holding the file watcher lock)")
	}

	ossBr, ossErr := currentBranch(p.OSS)
	geBr, geErr := currentBranch(p.Enterprise)
	if ossErr != nil || geErr != nil {
		printCheck(false, "could not read current branch in one or both repos")
	} else {
		if ossBr == geBr {
			printCheck(true, fmt.Sprintf("branch parity: both on %q", ossBr))
		} else {
			printCheck(false, fmt.Sprintf("branch mismatch OSS=%q enterprise=%q (consider grafdev dualize --yes)", ossBr, geBr))
		}
	}

	if base, err := remoteDefaultBranch(p.OSS, remote); err == nil {
		ref := fmt.Sprintf("%s/%s", remote, base)
		if b, a, err := commitsRelativeToRef(p.OSS, ref); err == nil {
			if b > 0 || a > 0 {
				printCheck(false, fmt.Sprintf("OSS vs %s: behind=%d ahead=%d (consider grafdev sync)", ref, b, a))
			} else {
				printCheck(true, fmt.Sprintf("OSS matches %s", ref))
			}
		}
	}
	if base, err := remoteDefaultBranch(p.Enterprise, remote); err == nil {
		ref := fmt.Sprintf("%s/%s", remote, base)
		if b, a, err := commitsRelativeToRef(p.Enterprise, ref); err == nil {
			if b > 0 || a > 0 {
				printCheck(false, fmt.Sprintf("enterprise vs %s: behind=%d ahead=%d (consider grafdev sync)", ref, b, a))
			} else {
				printCheck(true, fmt.Sprintf("enterprise matches %s", ref))
			}
		}
	}

	if quickBuild {
		_, _ = fmt.Fprintf(w, "\nRunning quick enterprise compile (go build -tags=enterprise)...\n")
		if err := quickEnterpriseBuild(p.OSS, ew); err != nil {
			printCheck(false, fmt.Sprintf("quick build failed: %v", err))
		} else {
			printCheck(true, "enterprise-tagged grafana binary compiled")
		}
	}

	if problems > 0 {
		_, _ = fmt.Fprintf(ew, "\n(%d check(s) reported issues above.)\n", problems)
		if strict {
			return fmt.Errorf("doctor: %d check(s) failed (--strict)", problems)
		}
	}
	return nil
}

func quickEnterpriseBuild(ossRoot string, logW io.Writer) error {
	tmp, err := os.CreateTemp("", "grafdev-grafana-*")
	if err != nil {
		return err
	}
	outPath := tmp.Name()
	_ = tmp.Close()
	_ = os.Remove(outPath)
	defer func() { _ = os.Remove(outPath) }()

	cmd := exec.Command("go", "build", "-tags=enterprise", "-o", outPath, "./pkg/cmd/grafana")
	cmd.Dir = ossRoot
	cmd.Stdout = logW
	cmd.Stderr = logW
	return cmd.Run()
}
