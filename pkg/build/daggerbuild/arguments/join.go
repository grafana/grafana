package arguments

import "github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"

func Join(f ...[]pipeline.Argument) []pipeline.Argument {
	total := 0
	for _, v := range f {
		total += len(v)
	}
	r := make([]pipeline.Argument, 0, total)
	for _, v := range f {
		r = append(r, v...)
	}

	return r
}
