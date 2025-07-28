package util

import "github.com/urfave/cli/v2"

// ArgCountWrapper will cause the action to fail if there were more than `num` args provided.
func MaxArgCountWrapper(max int, action cli.ActionFunc) cli.ActionFunc {
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
