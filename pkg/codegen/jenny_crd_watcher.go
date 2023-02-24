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
func CRDWatcherJenny(path string) OneToOne {
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

func (j crdWatcherJenny) Generate(kind kindsys.Kind) (*codejen.File, error) {
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

	codejen.NewFile(path, b, j)

	// check if watcher impl exists
	// if it does, then we don't want to overwrite it
	path = filepath.Join("..", j.parentpath, name, "watcher.go")
	if _, err = os.Stat(path); err == nil {
		return nil, nil
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

	return codejen.NewFile(path, b, j), nil
}
