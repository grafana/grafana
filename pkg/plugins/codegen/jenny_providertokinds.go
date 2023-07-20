package codegen

import (
	"fmt"

	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
)

func ProviderToKindsJenny(inner codejen.OneToOne[kindsys.Kind]) codejen.OneToMany[kindsys.Provider] {
	return &ptkJenny{
		inner: inner,
	}
}

type ptkJenny struct {
	inner codejen.OneToOne[kindsys.Kind]
}

func (*ptkJenny) JennyName() string {
	return "ProviderToKinds"
}

func (j *ptkJenny) Generate(provider kindsys.Provider) (codejen.Files, error) {
	all := provider.AllKinds()
	if len(all) == 0 {
		return nil, nil
	}

	files := make(codejen.Files, 0, len(all))

	for _, k := range all {
		f, err := j.inner.Generate(k)
		if err != nil {
			fmt.Printf("%s failed to generate for kind %s in %s", j.inner.JennyName(), k.Name(), provider.Name)
			continue
		}
		files = append(files, *f)
	}

	return files, nil
}
