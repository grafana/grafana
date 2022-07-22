package main

import "github.com/urfave/cli/v2"

func ArgCountWrapper(count int, action cli.ActionFunc) cli.ActionFunc {
	return func(ctx *cli.Context) error {
		if ctx.NArg() > count {
			if err := cli.ShowSubcommandHelp(ctx); err != nil {
				return cli.NewExitError(err.Error(), 1)
			}
			return cli.NewExitError("", 1)
		}

		return action(ctx)
	}
}
