package flags

import "github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"

func JoinFlags(f ...[]pipeline.Flag) []pipeline.Flag {
	total := 0
	for _, v := range f {
		total += len(v)
	}
	r := make([]pipeline.Flag, 0, total)
	for _, v := range f {
		r = append(r, v...)
	}

	return r
}
