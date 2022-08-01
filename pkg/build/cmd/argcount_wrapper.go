package main

import "github.com/urfave/cli/v2"

func ArgCountWrapper(max int, action cli.ActionFunc) cli.ActionFunc {
	return func(ctx *cli.Context) error {
		if ctx.NArg() > max {
			if err := cli.ShowSubcommandHelp(ctx); err != nil {
				return cli.Exit(err.Error(), 1)
			}
			return cli.Exit("", 1)
		}

		return action(ctx)
	}
}
