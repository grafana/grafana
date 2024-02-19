package codegen

import (
	"bytes"
	"cuelang.org/go/cue"
	"fmt"
	"github.com/grafana/codejen"
	"go/format"
	"strings"
)

// K8ResourcesJenny generates the resource information for each core kind.
type K8ResourcesJenny struct {
}

func (jenny *K8ResourcesJenny) JennyName() string {
	return "K8ResourcesJenny"
}

func (jenny *K8ResourcesJenny) Generate(data DataForGen) (codejen.Files, error) {
	files := make(codejen.Files, len(data.CueFiles))
	for i, val := range data.CueFiles {
		version, err := getVersion(val)
		if err != nil {
			return nil, err
		}

		pkg, err := val.LookupPath(cue.ParsePath("name")).String()
		if err != nil {
			return nil, fmt.Errorf("file %s doesn't have name field set: %s", data.Files[i], err)
		}

		pkgName := strings.ToLower(pkg)

		buf := new(bytes.Buffer)
		if err := tmpls.Lookup("core_resource.tmpl").Execute(buf, tvars_resource{
			PackageName: pkgName,
			KindName:    pkg,
			Version:     version,
		}); err != nil {
			return nil, fmt.Errorf("failed executing core resource template: %w", err)
		}

		content, err := format.Source(buf.Bytes())
		if err != nil {
			return nil, err
		}

		files[i] = *codejen.NewFile(fmt.Sprintf("pkg/kinds/%s/%s_gen.go", pkgName, pkgName), content, jenny)
	}

	return files, nil
}

func getVersion(val cue.Value) (string, error) {
	val = val.LookupPath(cue.ParsePath("lineage.schemas[0].version"))
	versionValues, err := val.List()
	if err != nil {
		return "", fmt.Errorf("missing version in schema: %s", err)
	}

	version := make([]int64, 0)
	for versionValues.Next() {
		v, err := versionValues.Value().Int64()
		if err != nil {
			return "", fmt.Errorf("version should be a list of two elements: %s", err)
		}

		version = append(version, v)
	}

	return fmt.Sprintf("%d-%d", version[0], version[1]), nil
}
