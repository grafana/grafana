package flags

import "github.com/urfave/cli/v2"

func Join(f ...[]cli.Flag) []cli.Flag {
	flags := []cli.Flag{}
	for _, v := range f {
		flags = append(flags, v...)
	}

	return flags
}
