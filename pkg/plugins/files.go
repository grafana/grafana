package plugins

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
)

var _ fs.FS = (*LocalFS)(nil)

type LocalFS struct {
	m        map[string]*LocalFile
	basePath string
}

func NewLocalFS(m map[string]struct{}, basePath string) LocalFS {
	pfs := map[string]*LocalFile{}
	for k := range m {
		pfs[k] = &LocalFile{
			path: k,
		}
	}

	return LocalFS{
		m:        pfs,
		basePath: basePath,
	}
}

func (f LocalFS) IsEmpty() bool {
	return len(f.m) == 0
}

func (f LocalFS) Exists(name string) bool {
	if _, exists := f.m[filepath.Join(f.basePath, name)]; exists {
		return true
	}
	if _, exists := f.m[name]; exists {
		return true
	}
	return false
}

func (f LocalFS) AbsFilepath(name string) (string, bool) {
	fp := filepath.Join(f.basePath, name)
	if _, exists := f.m[fp]; exists {
		return fp, true
	}
	return "", false
}

func (f LocalFS) Files() []string {
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

func (f LocalFS) Manifest() []byte {
	b, exists := f.Read("MANIFEST.txt")
	if !exists {
		return []byte{}
	}
	return b
}

func (f LocalFS) Read(name string) ([]byte, bool) {
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

func (f LocalFS) Open(name string) (fs.File, error) {
	if kv, exists := f.m[filepath.Join(f.basePath, name)]; exists {
		if kv.f != nil {
			return kv.f, nil
		}
		return os.Open(kv.path)
	}
	return nil, fmt.Errorf("file does not exist")
}

var _ fs.File = (*LocalFile)(nil)

type LocalFile struct {
	mu   sync.RWMutex
	f    *os.File
	path string
}

func (p *LocalFile) Stat() (fs.FileInfo, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return os.Stat(p.path)
}

func (p *LocalFile) Read(bytes []byte) (int, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	var err error
	p.f, err = os.Open(p.path)
	if err != nil {
		return 0, err
	}
	return p.f.Read(bytes)
}

func (p *LocalFile) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.f != nil {
		return p.f.Close()
	}
	p.f = nil
	return nil
}
