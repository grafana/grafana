package plugins

import (
	"bytes"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/util"
)

var _ fs.FS = (*LocalFS)(nil)

// LocalFS is a plugins.FS that allows accessing files on the local file system.
type LocalFS struct {
	// m is a map of relative file paths that can be accessed on the local filesystem.
	// The path separator must be os-specific.
	m map[string]*LocalFile

	// basePath is the basePath that will be prepended to all the files (in m map) before accessing them.
	basePath string
}

// NewLocalFS returns a new LocalFS that can access the specified files in the specified base path.
// Both the map keys and basePath should use the os-specific path separator for Open() to work properly.
func NewLocalFS(m map[string]struct{}, basePath string) LocalFS {
	pfs := make(map[string]*LocalFile, len(m))
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

// Open opens the specified file on the local filesystem, and returns the corresponding fs.File.
// If a nil error is returned, the caller should take care of closing the returned file.
func (f LocalFS) Open(name string) (fs.File, error) {
	cleanPath, err := util.CleanRelativePath(name)
	if err != nil {
		return nil, err
	}

	if kv, exists := f.m[filepath.Join(f.basePath, cleanPath)]; exists {
		if kv.f != nil {
			return kv.f, nil
		}
		file, err := os.Open(kv.path)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return nil, ErrFileNotExist
			}
			return nil, ErrPluginFileRead
		}
		return file, nil
	}
	return nil, ErrFileNotExist
}

// Base returns the base path for the LocalFS.
func (f LocalFS) Base() string {
	return f.basePath
}

// Files returns a slice of all the file paths in the LocalFS relative to the base path.
// The returned strings use the same path separator as the
func (f LocalFS) Files() []string {
	var files []string
	for p := range f.m {
		r, err := filepath.Rel(f.basePath, p)
		if strings.Contains(r, "..") || err != nil {
			continue
		}
		files = append(files, r)
	}

	return files
}

var _ fs.File = (*LocalFile)(nil)

// LocalFile implements a fs.File for accessing the local filesystem.
type LocalFile struct {
	f    *os.File
	path string
}

// Stat returns a FileInfo describing the named file.
// It returns ErrFileNotExist if the file does not exist, or ErrPluginFileRead if another error occurs.
func (p *LocalFile) Stat() (fs.FileInfo, error) {
	fi, err := os.Stat(p.path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, ErrFileNotExist
		}
		return nil, ErrPluginFileRead
	}
	return fi, nil
}

// Read reads up to len(b) bytes from the File and stores them in b.
// It returns the number of bytes read and any error encountered.
// At end of file, Read returns 0, io.EOF.
// If the file is already open, it is opened again, without closing it first.
// The file is not closed at the end of the read operation. If a non-nil error is returned, it
// must be manually closed by the caller by calling Close().
func (p *LocalFile) Read(b []byte) (int, error) {
	if p.f != nil {
		// File is already open, Read() can be called more than once.
		// io.EOF is returned if the file has been read entirely.
		return p.f.Read(b)
	}

	var err error
	p.f, err = os.Open(p.path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return 0, ErrFileNotExist
		}
		return 0, ErrPluginFileRead
	}
	return p.f.Read(b)
}

// Close closes the file.
// If the file was never open, nil is returned.
// If the file is already closed, an error is returned.
func (p *LocalFile) Close() error {
	if p.f != nil {
		return p.f.Close()
	}
	p.f = nil
	return nil
}

type inMemoryFS struct {
	files map[string][]byte
}

func NewInMemoryFS(files map[string][]byte) FS {
	return &inMemoryFS{files: files}
}

func (f inMemoryFS) Base() string {
	return ""
}

func (f inMemoryFS) Files() []string {
	fps := make([]string, 0, len(f.files))
	for fn := range f.files {
		fps = append(fps, fn)
	}
	return fps
}

func (f inMemoryFS) Open(fn string) (fs.File, error) {
	if _, ok := f.files[fn]; !ok {
		return nil, ErrFileNotExist
	}
	return &inMemoryFile{path: fn, reader: bytes.NewReader(f.files[fn])}, nil
}

type inMemoryFile struct {
	path   string
	reader *bytes.Reader
}

func (f *inMemoryFile) Stat() (fs.FileInfo, error) {
	return inMemoryFileInfo{
		name: f.path,
		size: f.reader.Size(),
	}, nil
}

func (f *inMemoryFile) Read(b []byte) (int, error) {
	return f.reader.Read(b)
}

func (f *inMemoryFile) Close() error {
	return nil
}

type inMemoryFileInfo struct {
	name string
	size int64
}

func (f inMemoryFileInfo) Name() string       { return f.name }
func (f inMemoryFileInfo) Size() int64        { return f.size }
func (f inMemoryFileInfo) Mode() os.FileMode  { return 0444 } // Read for all
func (f inMemoryFileInfo) ModTime() time.Time { return time.Time{} }
func (f inMemoryFileInfo) IsDir() bool        { return false }
func (f inMemoryFileInfo) Sys() interface{}   { return nil }
