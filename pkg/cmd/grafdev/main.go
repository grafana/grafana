package main

import (
	"fmt"
	"os"

	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Name:  "grafdev",
		Usage: "Prototype helper for Grafana OSS + grafana-enterprise local development",
		Flags: []cli.Flag{
			&cli.StringFlag{Name: "oss", Usage: "Path to Grafana OSS checkout (default: walk parents for go.mod or GRAFANA_DEV_OSS)"},
			&cli.StringFlag{Name: "enterprise", Usage: "Path to grafana-enterprise checkout (default: sibling ../grafana-enterprise)"},
		},
		Commands: []*cli.Command{
			cmdContext(),
			cmdBranch(),
			cmdDualize(),
			cmdDoctor(),
			cmdSync(),
			cmdLink(),
			cmdImports(),
			cmdWire(),
			cmdVerify(),
			cmdSmoke(),
		},
	}
	if err := app.Run(os.Args); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}

func resolve(c *cli.Context) (RepoPaths, error) {
	return ResolveRepos(c.String("oss"), c.String("enterprise"))
}

func mustResolve(c *cli.Context) (RepoPaths, error) {
	p, err := resolve(c)
	if err != nil {
		return RepoPaths{}, fmt.Errorf("%w\n(hint: run from the Grafana OSS checkout or pass --oss)", err)
	}
	return p, nil
}
