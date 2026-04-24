package flags

import "github.com/urfave/cli/v2"

func Join(f ...[]cli.Flag) []cli.Flag {
	total := 0
	for _, v := range f {
		total += len(v)
	}
	flags := make([]cli.Flag, 0, total)
	for _, v := range f {
		flags = append(flags, v...)
	}

	return flags
}
