//go:build oss
// +build oss

package main

import "github.com/urfave/cli/v2"

// Used to add extra startup commands to the enterprise build
func getExtraCommands() []*cli.Command {
	return []*cli.Command{}
}
