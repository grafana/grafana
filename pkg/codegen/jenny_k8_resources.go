package codegen

import (
	"bytes"
	"fmt"
	"go/format"
	"strings"

	"cuelang.org/go/cue"
	"github.com/grafana/codejen"
)

// K8ResourcesJenny generates resource, metadata and status for each file.
type K8ResourcesJenny struct {
}

func (jenny *K8ResourcesJenny) JennyName() string {
	return "K8ResourcesJenny"
}

func (jenny *K8ResourcesJenny) Generate(cueFiles []cue.Value) (codejen.Files, error) {
	files := make(codejen.Files, 0)
	for _, val := range cueFiles {
		pkg, err := getPackageName(val)
		if err != nil {
			return nil, err
		}

		resource, err := jenny.genResource(pkg, val)
		if err != nil {
			return nil, err
		}

		metadata, err := jenny.genMetadata(pkg)
		if err != nil {
			return nil, err
		}

		status, err := jenny.genStatus(pkg)
		if err != nil {
			return nil, err
		}

		files = append(files, resource)
		files = append(files, metadata)
		files = append(files, status)
	}

	return files, nil
}

func (jenny *K8ResourcesJenny) genResource(pkg string, val cue.Value) (codejen.File, error) {
	version, err := getVersion(val)
	if err != nil {
		return codejen.File{}, err
	}

	pkgName := strings.ToLower(pkg)

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_resource.tmpl").Execute(buf, tvars_resource{
		PackageName: pkgName,
		KindName:    pkg,
		Version:     version,
	}); err != nil {
		return codejen.File{}, fmt.Errorf("failed executing core resource template: %w", err)
	}

	content, err := format.Source(buf.Bytes())
	if err != nil {
		return codejen.File{}, err
	}

	return *codejen.NewFile(fmt.Sprintf("pkg/kinds/%s/%s_gen.go", pkgName, pkgName), content, jenny), nil
}

func (jenny *K8ResourcesJenny) genMetadata(pkg string) (codejen.File, error) {
	pkg = strings.ToLower(pkg)

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_metadata.tmpl").Execute(buf, tvars_metadata{
		PackageName: pkg,
	}); err != nil {
		return codejen.File{}, fmt.Errorf("failed executing core resource template: %w", err)
	}

	return *codejen.NewFile(fmt.Sprintf("pkg/kinds/%s/%s_metadata_gen.go", pkg, pkg), buf.Bytes(), jenny), nil
}

func (jenny *K8ResourcesJenny) genStatus(pkg string) (codejen.File, error) {
	pkg = strings.ToLower(pkg)

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_status.tmpl").Execute(buf, tvars_status{
		PackageName: pkg,
	}); err != nil {
		return codejen.File{}, fmt.Errorf("failed executing core resource template: %w", err)
	}

	return *codejen.NewFile(fmt.Sprintf("pkg/kinds/%s/%s_status_gen.go", pkg, pkg), buf.Bytes(), jenny), nil
}

func getPackageName(val cue.Value) (string, error) {
	name := val.LookupPath(cue.ParsePath("name"))
	pkg, err := name.String()
	if err != nil {
		return "", fmt.Errorf("file doesn't have name field set: %s", err)
	}
	return pkg, nil
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
