package codegen

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
)

// LatestMajorsOrXJenny returns a jenny that repeats the input for the latest in each major version.
func LatestMajorsOrXJenny(parentdir string) OneToMany {
	return &lmox{
		parentdir: parentdir,
		inner: TSCogTypesJenny{
			constantToEnum: map[string][]string{
				"dashboard": {"DashboardLinkPlacement", "ActionVariableType", "AnnotationQueryPlacement"},
			},
		},
	}
}

type lmox struct {
	parentdir string
	inner     codejen.OneToOne[SchemaForGen]
}

func (j *lmox) JennyName() string {
	return "LatestMajorsOrXJenny"
}

func (j *lmox) Generate(sfg SchemaForGen) (codejen.Files, error) {
	sfg.IsGroup = true
	f, err := j.inner.Generate(sfg)
	if err != nil {
		return nil, fmt.Errorf("%s jenny failed for %s: %w", j.inner.JennyName(), sfg.Name, err)
	}
	if f == nil || !f.Exists() {
		return nil, nil
	}

	f.RelativePath = filepath.Join(j.parentdir, sfg.OutputName, "x", f.RelativePath)
	f.From = append(f.From, j)
	return codejen.Files{*f}, nil
}
