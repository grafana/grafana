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
		Flags: globalPathFlags(),
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
			cmdGe(),
		},
	}
	if err := app.Run(os.Args); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}

func resolve(c *cli.Context) (RepoPaths, error) {
	return ResolveRepos(flagFromContext(c, "oss"), flagFromContext(c, "enterprise"))
}

func mustResolve(c *cli.Context) (RepoPaths, error) {
	p, err := resolve(c)
	if err != nil {
		return RepoPaths{}, fmt.Errorf("%w\n(hint: run from the Grafana OSS checkout, pass --oss / --enterprise, or set GRAFANA_DEV_OSS)", err)
	}
	return p, nil
}
