package codegen

import (
	"bytes"
	"cuelang.org/go/cue"
	"fmt"
	"github.com/grafana/codejen"
	"strings"
)

type K8MetadataJenny struct {
}

func (jenny *K8MetadataJenny) JennyName() string {
	return "K8MetadataJenny"
}

func (jenny *K8MetadataJenny) Generate(data DataForGen) (codejen.Files, error) {
	files := make(codejen.Files, len(data.CueFiles))
	for i, val := range data.CueFiles {
		name := val.LookupPath(cue.ParsePath("name"))
		pkg, err := name.String()
		if err != nil {
			return nil, fmt.Errorf("file %s doesn't have name field set: %s", data.Files[i], err)
		}

		buf := new(bytes.Buffer)
		if err := tmpls.Lookup("core_metadata.tmpl").Execute(buf, tvars_metadata{
			PackageName: strings.ToLower(pkg),
		}); err != nil {
			return nil, fmt.Errorf("failed executing core resource template: %w", err)
		}

		files[i] = *codejen.NewFile(fmt.Sprintf("pkg/kinds/%s/%s_gen.go", pkg, pkg), buf.Bytes(), jenny)
	}

	return files, nil
}
