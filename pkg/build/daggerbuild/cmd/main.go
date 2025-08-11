package cmd

import (
	"errors"
	"fmt"
	"os"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipelines"
	"github.com/urfave/cli/v2"
)

// Deprecated: use the Artifact type instead
func PipelineActionWithPackageInput(pf pipelines.PipelineFuncWithPackageInput) cli.ActionFunc {
	return func(c *cli.Context) error {
		var (
			ctx  = c.Context
			opts = []dagger.ClientOpt{}
		)
		if c.Bool("verbose") {
			opts = append(opts, dagger.WithLogOutput(os.Stderr))
		}
		client, err := dagger.Connect(ctx, opts...)
		if err != nil {
			return err
		}
		defer func(c *dagger.Client) {
			if err := c.Close(); err != nil {
				fmt.Println("error closing dagger client:", err)
			}
		}(client)

		args, err := pipelines.PipelineArgsFromContext(ctx, c)
		if err != nil {
			return err
		}

		if len(args.PackageInputOpts.Packages) == 0 {
			return errors.New("expected at least one package from a '--package' flag")
		}

		if err := pf(ctx, client, args); err != nil {
			return err
		}
		return nil
	}
}
