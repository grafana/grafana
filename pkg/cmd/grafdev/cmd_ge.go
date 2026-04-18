package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/urfave/cli/v2"
)

// cmdGe proxies subprocess execution into the grafana-enterprise checkout so agents
// (often cwd = OSS only) do not need to cd ../grafana-enterprise for every git call.
func cmdGe() *cli.Command {
	return &cli.Command{
		Name:  "ge",
		Usage: "Run a subprocess with working directory = grafana-enterprise (git, shell scripts, etc.)",
		Flags: globalPathFlags(),
		Description: `Set OSS / enterprise paths on the root command or right after ge (both work), for example:

  grafdev --oss /path/to/grafana ge git status -sb
  grafdev ge --oss /path/to/grafana git status -sb

You can also rely on GRAFANA_DEV_OSS / GRAFANA_DEV_ENTERPRISE (see flag EnvVars).`,
		Subcommands: []*cli.Command{
			{
				Name:            "git",
				Usage:           "Run git in the enterprise checkout; all arguments after 'git' are forwarded",
				ArgsUsage:       "[git arguments...]",
				SkipFlagParsing: true,
				Action:          geGitAction,
			},
			{
				Name:            "run",
				Usage:           "Run an arbitrary program in the enterprise checkout; first arg is the executable",
				ArgsUsage:       "<program> [arguments...]",
				SkipFlagParsing: true,
				Action:          geRunAction,
			},
		},
	}
}

func geGitAction(c *cli.Context) error {
	p, err := mustResolve(c)
	if err != nil {
		return err
	}
	args := c.Args().Slice()
	gitBin, err := exec.LookPath("git")
	if err != nil {
		return err
	}
	cmd := exec.Command(gitBin, args...)
	cmd.Dir = p.Enterprise
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ge git: %w", err)
	}
	return nil
}

func geRunAction(c *cli.Context) error {
	p, err := mustResolve(c)
	if err != nil {
		return err
	}
	args := c.Args().Slice()
	if len(args) == 0 {
		return fmt.Errorf("ge run: need at least a program name, e.g. grafdev ge run git status")
	}
	progName := args[0]
	var prog string
	if filepath.IsAbs(progName) {
		st, err := os.Stat(progName)
		if err != nil {
			return fmt.Errorf("ge run: stat %q: %w", progName, err)
		}
		if st.IsDir() {
			return fmt.Errorf("ge run: %q is a directory, not an executable", progName)
		}
		prog = progName
	} else {
		p, err := exec.LookPath(progName)
		if err != nil {
			return fmt.Errorf("ge run: %q not found on PATH: %w", progName, err)
		}
		prog = p
	}
	cmd := exec.Command(prog, args[1:]...)
	cmd.Dir = p.Enterprise
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ge run: %w", err)
	}
	return nil
}
