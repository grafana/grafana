package plugins

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/util"
)

var _ FS = (*LocalFS)(nil)

// CollectFilesWalkFuncProvider is a function that returns a filepath.WalkFunc, which will accumulate its results into acc.
type CollectFilesWalkFuncProvider func(acc map[string]struct{}) filepath.WalkFunc

// LocalFS is a plugins.FS that allows accessing files on the local file system.
type LocalFS struct {
	// basePath is the basePath that will be prepended to all the files (in allowList map) before accessing them.
	basePath string

	// walkFuncProvider returns a filepath.WalkFunc that creates a list of files in this LocalFS for Files()
	walkFuncProvider CollectFilesWalkFuncProvider
}

// NewLocalFS returns a new LocalFS that can access any file in the specified base path on the filesystem.
// basePath must use os-specific path separator for Open() to work properly.
func NewLocalFS(basePath string, walkFuncProvider CollectFilesWalkFuncProvider) LocalFS {
	return LocalFS{basePath: basePath, walkFuncProvider: walkFuncProvider}
}

// Open opens the specified file on the local filesystem.
// The provided name must use os-specific path separators.
// It returns the corresponding fs.File.
// If a nil error is returned, the caller should take care of closing the returned file.
func (f LocalFS) Open(name string) (fs.File, error) {
	cleanPath, err := util.CleanRelativePath(name)
	if err != nil {
		return nil, err
	}
	// TODO: path traversal check
	fn := filepath.Join(f.basePath, cleanPath)
	if _, err := os.Stat(fn); err != nil {
		return nil, ErrFileNotExist
	}
	return &LocalFile{path: fn}, nil
}

// Base returns the base path for the LocalFS.
// The returned string uses os-specific path separator.
func (f LocalFS) Base() string {
	return f.basePath
}

// Files returns a slice of all the file paths on the LocalFS relative to the base path.
// The returned strings use os-specific path separator.
func (f LocalFS) Files() ([]string, error) {
	if f.walkFuncProvider == nil {
		return nil, nil
	}
	filesMap := make(map[string]struct{})
	if err := filepath.Walk(f.basePath, f.walkFuncProvider(filesMap)); err != nil {
		return nil, fmt.Errorf("walk: %w", err)
	}
	files := make([]string, 0, len(filesMap))
	for fn := range filesMap {
		files = append(files, fn)
	}
	/* var files []string
	for p := range f.allowList {
		r, err := filepath.Rel(f.basePath, p)
		if strings.Contains(r, "..") || err != nil {
			continue
		}
		files = append(files, r)
	} */
	return files, nil
}

type fsAllowList map[string]struct{}

func newFSAllowList(files map[string]struct{}) fsAllowList {
	// Copy map so it cannot be modified from outside
	allowListCopy := fsAllowList(make(map[string]struct{}, len(files)))
	for k := range files {
		allowListCopy[k] = struct{}{}
	}
	return allowListCopy
}

// key returns the corresponding internal map key for the provided path.
/* func (a fsAllowList) key(path string) string {
	cleanPath, err := util.CleanRelativePath(path)
	if err != nil {
		return ""
	}
	return cleanPath
} */

func (a fsAllowList) isAllowed(path string) bool {
	_, ok := a[path]
	return ok
}

var _ FS = (*AllowListLocalFS)(nil)

// AllowListLocalFS wraps a LocalFS and allows accessing only the files in the allowList.
// This is a more secure implementation of LocalFS suitable for production environments.
type AllowListLocalFS struct {
	LocalFS

	// allowList is a map of relative file paths that can be accessed on the local filesystem.
	// The path separator must be os-specific.
	allowList fsAllowList
}

// NewAllowListLocalFS returns a new AllowListLocalFS that can access the files in the specified base path on
// the filesystem, but ONLY if they are also specified in the provided allowList.
// All paths in the allowList and basePath must use os-specific path separator for Open() to work properly.
func NewAllowListLocalFS(allowList map[string]struct{}, basePath string, walkFuncProvider CollectFilesWalkFuncProvider) AllowListLocalFS {
	return AllowListLocalFS{
		LocalFS:   NewLocalFS(basePath, walkFuncProvider),
		allowList: newFSAllowList(allowList),
	}
}

// Open checks that name is an allowed file and returns a fs.File to access it.
func (f AllowListLocalFS) Open(name string) (fs.File, error) {
	// Ensure access to the file is allowed
	cleanRelativePath, err := util.CleanRelativePath(name)
	if err != nil {
		return nil, err
	}
	if !f.allowList.isAllowed(filepath.Join(f.basePath, cleanRelativePath)) {
		return nil, ErrFileNotExist
	}
	// Use the wrapped LocalFS to access the file
	return f.LocalFS.Open(name)
}

// Files returns a slice of all the file paths in the LocalFS relative to the base path.
func (f AllowListLocalFS) Files() ([]string, error) {
	// Get files on the filesystem (walk)
	filesystemFiles, err := f.LocalFS.Files()
	if err != nil {
		return filesystemFiles, err
	}
	// TODO: FS: ???? Separate Walker and Files implementation??
	if len(filesystemFiles) == 0 {
		files := make([]string, 0, len(f.allowList))
		for p := range f.allowList {
			r, err := filepath.Rel(f.basePath, p)
			if strings.Contains(r, "..") || err != nil {
				continue
			}
			files = append(files, p)
		}
		return files, nil
	}

	// Intersect with allow list
	files := make([]string, 0, len(filesystemFiles))
	for _, fn := range filesystemFiles {
		/* r, err := filepath.Rel(f.basePath, fn)
		if strings.Contains(r, "..") || err != nil {
			continue
		}
		if _, ok := f.allowList[fn]; !ok {
			continue
		} */
		if !f.allowList.isAllowed(fn) {
			continue
		}
		files = append(files, fn)
	}
	return files, nil
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
