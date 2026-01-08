package flags

import "github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"

func JoinFlags(f ...[]pipeline.Flag) []pipeline.Flag {
	r := []pipeline.Flag{}
	for _, v := range f {
		r = append(r, v...)
	}

	return r
}
