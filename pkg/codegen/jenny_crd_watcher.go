package codegen

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
)

// CRDWatcherJenny generates WatcherWrapper implementations for a CRD.
func CRDWatcherJenny(path string) OneToMany {
	return crdWatcherJenny{
		parentpath: path,
	}
}

type crdWatcherJenny struct {
	parentpath string
}

func (j crdWatcherJenny) JennyName() string {
	return "CRDWatcherJenny"
}

func (j crdWatcherJenny) Generate(kind kindsys.Kind) (codejen.Files, error) {
	files := make(codejen.Files, 0)
	_, isCore := kind.(kindsys.Core)
	_, isCustom := kind.(kindsys.Core)
	if !(isCore || isCustom) {
		return nil, nil
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_crd_watcher.tmpl").Execute(buf, kind); err != nil {
		return nil, fmt.Errorf("failed executing crd watcher template: %w", err)
	}

	name := kind.Props().Common().MachineName
	path := filepath.Join(j.parentpath, name, "watcher_gen.go")
	b, err := postprocessGoFile(genGoFile{
		path: path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	file := codejen.NewFile(path, b, j)
	if file == nil {
		return nil, fmt.Errorf("failed to create file %q", path)
	}
	files = append(files, *file)

	// check if watcher impl exists
	// if it does, then we don't want to overwrite it
	path = filepath.Join("..", j.parentpath, name, "watcher.go")
	if _, err = os.Stat(path); err == nil {
		return files, nil
	}

	buf = new(bytes.Buffer)
	if err := tmpls.Lookup("core_crd_watcher_impl.tmpl").Execute(buf, kind); err != nil {
		return nil, fmt.Errorf("failed executing crd watcher template: %w", err)
	}

	path = filepath.Join(j.parentpath, name, "watcher.go")
	b, err = postprocessGoFile(genGoFile{
		path: path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	file = codejen.NewFile(path, b, j)
	if file == nil {
		return nil, fmt.Errorf("failed to create file %q", path)
	}
	files = append(files, *file)

	return files, nil
}
