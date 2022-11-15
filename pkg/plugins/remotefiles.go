package plugins

import (
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var _ fs.FS = (*RemoteFS)(nil)

type RemoteFS struct {
	client *http.Client

	m        map[string]*RemoteFile
	basePath *url.URL
}

func NewRemoteFS(basePath *url.URL, files map[string]string, manifest []byte) RemoteFS {
	pfs := make(map[string]*RemoteFile)
	for fp, hash := range files {
		pfs[path.Join(basePath.String(), fp)] = &RemoteFile{
			path: fp,
			hash: hash,
		}
	}

	pfs[path.Join(basePath.String(), "MANIFEST.txt")] = &RemoteFile{
		path: "MANIFEST.txt",
		data: manifest,
	}

	return RemoteFS{
		client:   http.DefaultClient,
		m:        pfs,
		basePath: basePath,
	}
}

func (f RemoteFS) Base() string {
	return f.basePath.String()
}

func (f RemoteFS) Exists(name string) bool {
	if _, exists := f.m[path.Join(f.Base(), name)]; exists {
		return true
	}
	if _, exists := f.m[name]; exists {
		return true
	}
	return false
}

func (f RemoteFS) FullPath(name string) (string, bool) {
	fp := path.Join(f.Base(), name)
	if _, exists := f.m[fp]; exists {
		return fp, true
	}
	return "", false
}

func (f RemoteFS) Files() []string {
	var files []string
	for p := range f.m {
		r, err := filepath.Rel(f.Base(), p)
		if strings.Contains(r, "..") || err != nil {
			continue
		}
		files = append(files, r)
	}

	return files
}

func (f RemoteFS) Read(name string) ([]byte, bool) {
	fullPath := path.Join(f.Base(), name)
	file, exists := f.m[fullPath]
	if !exists {
		return []byte{}, false
	}

	if file.data != nil {
		return file.data, true
	}

	res, err := f.client.Get(fullPath)
	if err != nil {
		return []byte{}, false
	}

	b, err := io.ReadAll(res.Body)
	if err != nil {
		return []byte{}, false
	}

	if err = res.Body.Close(); err != nil {
		return []byte{}, false
	}
	return b, true
}

func (f RemoteFS) Open(name string) (fs.File, error) {
	if file, exists := f.m[path.Join(f.Base(), name)]; exists {
		return file, nil
	}
	return nil, fmt.Errorf("file does not exist")
}

var _ fs.File = (*RemoteFile)(nil)

type RemoteFile struct {
	mu   sync.RWMutex
	path string
	hash string

	fi *remoteFileInfo

	data []byte
}

func (p *RemoteFile) Stat() (fs.FileInfo, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.fi, nil
}

func (p *RemoteFile) Read(bytes []byte) (int, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return 0, nil
}

func (p *RemoteFile) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	return nil
}

type remoteFileInfo struct {
}

func (fi *remoteFileInfo) Name() string {
	return ""
}

func (fi *remoteFileInfo) Size() int64 {
	return 0
}

func (fi *remoteFileInfo) Mode() fs.FileMode {
	return 0
}

func (fi *remoteFileInfo) ModTime() time.Time {
	return time.Time{}
}

func (fi *remoteFileInfo) IsDir() bool {
	return false
}

func (fi *remoteFileInfo) Sys() any {
	return 0
}
