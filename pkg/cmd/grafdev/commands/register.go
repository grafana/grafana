package commands

import "github.com/urfave/cli/v2"

// All returns top-level grafdev subcommands.
func (d Deps) All() []*cli.Command {
	return []*cli.Command{
		d.cmdContext(),
		d.cmdBranch(),
		d.cmdDualize(),
		d.cmdDoctor(),
		d.cmdSync(),
		d.cmdLink(),
		d.cmdImports(),
		d.cmdWire(),
		d.cmdVerify(),
		d.cmdSmoke(),
		d.cmdGe(),
	}
}
