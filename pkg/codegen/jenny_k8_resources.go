package codegen

import (
	"bytes"
	"fmt"
	"go/format"
	"strings"

	"github.com/grafana/codejen"
)

// K8ResourcesJenny generates resource, metadata and status for each file.
type K8ResourcesJenny struct {
}

func (jenny *K8ResourcesJenny) JennyName() string {
	return "K8ResourcesJenny"
}

func (jenny *K8ResourcesJenny) Generate(cueFiles ...SchemaForGen) (codejen.Files, error) {
	files := make(codejen.Files, 0)
	for _, val := range cueFiles {
		resource, err := jenny.genResource(val.Name, val.Version)
		if err != nil {
			return nil, err
		}

		metadata, err := jenny.genMetadata(val.Name)
		if err != nil {
			return nil, err
		}

		status, err := jenny.genStatus(val.Name)
		if err != nil {
			return nil, err
		}

		files = append(files, resource)
		files = append(files, metadata)
		files = append(files, status)
	}

	return files, nil
}

func (jenny *K8ResourcesJenny) genResource(pkg string, version string) (codejen.File, error) {
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
