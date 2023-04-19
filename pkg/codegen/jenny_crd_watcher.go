package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
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
	_, isCustom := kind.(kindsys.Custom)
	if !(isCore || isCustom) {
		return nil, nil
	}

	name := kind.Props().Common().MachineName
	if name == "dashboard" {
		return nil, nil
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_crd_watcher.tmpl").Execute(buf, kind); err != nil {
		return nil, fmt.Errorf("failed executing crd watcher template: %w", err)
	}

	path := filepath.Join(j.parentpath, name, name+"_watcher_gen.go")
	b, err := postprocessGoFile(genGoFile{
		path: path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(path, b, j), nil
}
