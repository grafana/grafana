package plugins

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

var _ fs.FS = (*FileSystem)(nil)

type FileSystem struct {
	m        map[string]PluginFile
	basePath string
}

func NewFileSystem(m map[string]struct{}, basePath string) FileSystem {
	pfs := map[string]PluginFile{}
	for k := range m {
		pfs[k] = PluginFile{
			path: k,
		}
	}

	return FileSystem{
		m:        pfs,
		basePath: basePath,
	}
}

func (f FileSystem) IsEmpty() bool {
	return len(f.m) == 0
}

func (f FileSystem) Exists(name string) bool {
	if _, exists := f.m[filepath.Join(f.basePath, name)]; exists {
		return true
	}
	if _, exists := f.m[name]; exists {
		return true
	}
	return false
}

func (f FileSystem) AbsFilepath(name string) (string, bool) {
	fp := filepath.Join(f.basePath, name)
	if _, exists := f.m[fp]; exists {
		return fp, true
	}
	return "", false
}

func (f FileSystem) Files() []string {
	var files []string
	for p := range f.m {
		r, err := filepath.Rel(f.basePath, p)
		if err != nil {
			continue
		}
		files = append(files, r)
	}

	return files
}

func (f FileSystem) Manifest() []byte {
	b, exists := f.Read("MANIFEST.txt")
	if !exists {
		return []byte{}
	}
	return b
}

var _ fs.File = (*PluginFile)(nil)

type PluginFile struct {
	f    *os.File
	path string
}

func (p PluginFile) Stat() (fs.FileInfo, error) {
	return os.Stat(p.path)
}

func (p PluginFile) Read(bytes []byte) (int, error) {
	var err error
	p.f, err = os.Open(p.path)
	if err != nil {
		return 0, err
	}
	return p.f.Read(bytes)
}

func (p PluginFile) Close() error {
	if p.f != nil {
		return p.f.Close()
	}
	return nil
}

func (f FileSystem) Read(name string) ([]byte, bool) {
	m, err := f.Open(name)
	if err != nil {
		return []byte{}, false
	}

	b, err := io.ReadAll(m)
	if err != nil {
		return []byte{}, false
	}

	if err = m.Close(); err != nil {
		return []byte{}, false
	}
	return b, true
}

func (f FileSystem) Open(name string) (fs.File, error) {
	if kv, exists := f.m[filepath.Join(f.basePath, name)]; exists {
		if kv.f != nil {
			return kv.f, nil
		}
		return os.Open(kv.path)
	}
	return nil, fmt.Errorf("file does not exist")
}
