package codegen

import (
	"bytes"
	"cuelang.org/go/cue"
	"fmt"
	"github.com/grafana/codejen"
	"strings"
)

type K8StatusJenny struct {
}

func (jenny *K8StatusJenny) JennyName() string {
	return "K8StatusJenny"
}

func (jenny *K8StatusJenny) Generate(data DataForGen) (codejen.Files, error) {
	files := make(codejen.Files, len(data.CueFiles))
	for i, val := range data.CueFiles {
		name := val.LookupPath(cue.ParsePath("name"))
		pkg, err := name.String()
		if err != nil {
			return nil, fmt.Errorf("file %s doesn't have name field set: %s", data.Files[i], err)
		}

		pkg = strings.ToLower(pkg)

		buf := new(bytes.Buffer)
		if err := tmpls.Lookup("core_status.tmpl").Execute(buf, tvars_status{
			PackageName: pkg,
		}); err != nil {
			return nil, fmt.Errorf("failed executing core resource template: %w", err)
		}

		files[i] = *codejen.NewFile(fmt.Sprintf("pkg/kinds/%s/%s_status_gen.go", pkg, pkg), buf.Bytes(), jenny)
	}

	return files, nil
}
