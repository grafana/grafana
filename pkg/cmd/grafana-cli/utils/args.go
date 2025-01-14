package utils

import "github.com/urfave/cli/v2"

//go:generate mockery --name Args --structname MockArgs --outpkg utils --filename args_mock.go --output .
type Args = cli.Args
