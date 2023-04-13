package plugins

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/util"
)

var _ FS = (*LocalFS)(nil)

// LocalFS is a plugins.FS that allows accessing files on the local file system.
type LocalFS struct {
	// allowList is a map of relative file paths that can be accessed on the local filesystem.
	// The path separator must be os-specific.
	allowList map[string]struct{}

	// basePath is the basePath that will be prepended to all the files (in allowList map) before accessing them.
	basePath string

	// allowAll is a flag that allows to bypass the allow-list checks when calling Open().
	// If true, Open() will also allow accessing files that aren't in allowList (as long as it exists on the filesystem).
	// If false, Open() will return ErrFileNotExist if the specified file is not explicitly allowed,
	// even if the file exists on the underlying file system.
	allowAll bool
}

// LocalFSOption mutates a LocalFS allowing to specify some options.
type LocalFSOption func(*LocalFS)

// LocalFSOptionAllowAll sets allowAll to true, disabling the allow-list on the LocalFS.
func LocalFSOptionAllowAll(f *LocalFS) {
	f.allowAll = true
}

// NewLocalFS returns a new LocalFS that can access the specified files in the specified base path.
// Both the map keys and basePath should use the os-specific path separator for Open() to work properly.
func NewLocalFS(allowList map[string]struct{}, basePath string, opts ...LocalFSOption) LocalFS {
	// Copy the allowList to make it read-only.
	pfs := make(map[string]struct{}, len(allowList))
	for k := range allowList {
		pfs[k] = struct{}{}
	}
	r := LocalFS{
		allowList: pfs,
		basePath:  basePath,
	}
	// Apply additional options.
	for _, opt := range opts {
		opt(&r)
	}
	return r
}

// Open opens the specified file on the local filesystem, and returns the corresponding fs.File.
// If a nil error is returned, the caller should take care of closing the returned file.
func (f LocalFS) Open(name string) (fs.File, error) {
	cleanPath, err := util.CleanRelativePath(name)
	if err != nil {
		return nil, err
	}
	fn := filepath.Join(f.basePath, cleanPath)
	if _, exists := f.allowList[fn]; !exists {
		if !f.allowAll {
			return nil, ErrFileNotExist
		}
		// TODO: path traversal check
		// Bypass allow-list
		if _, err := os.Stat(fn); err != nil {
			return nil, ErrFileNotExist
		}
	}
	return &LocalFile{path: fn}, nil
}

// Base returns the base path for the LocalFS.
func (f LocalFS) Base() string {
	return f.basePath
}

// Files returns a slice of all the file paths in the LocalFS relative to the base path.
// The returned strings use the same path separator as the
func (f LocalFS) Files() []string {
	var files []string
	for p := range f.allowList {
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
