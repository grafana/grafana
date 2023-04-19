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

// CollectFilesFunc is a function that returns a filepath.WalkFunc, which will accumulate its results into acc.
// The file paths collected into acc should be absolute file paths (like the first argument provided to
// filepath.WalkFunc)
type CollectFilesFunc func(acc map[string]struct{}) filepath.WalkFunc

// defaultCollectFilesFunc is a simple CollectFilesFunc that skips all directories and collects all paths into acc.
var defaultCollectFilesFunc CollectFilesFunc = func(acc map[string]struct{}) filepath.WalkFunc {
	return func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		acc[path] = struct{}{}
		return nil
	}
}

// emptyCollectFilesFunc is a no-op CollectFilesFunc. It returns a filepath.WalkFunc that does nothing and
// the accumulator map is not altered in any way. This is suitable to use with plugins.allowListFSNoFiles for tests.
func emptyCollectFilesFunc(_ map[string]struct{}) filepath.WalkFunc {
	return func(path string, info fs.FileInfo, err error) error {
		return nil
	}
}

// LocalFS is a plugins.FS that allows accessing files on the local file system.
type LocalFS struct {
	// basePath is the basePath that will be prepended to all the files to get their absolute path.
	basePath string

	// collectFilesFunc returns a filepath.WalkFunc that creates a slice of files in this LocalFS, for Files()
	collectFilesFunc CollectFilesFunc
}

// NewLocalFS returns a new LocalFS that can access any file in the specified base path on the filesystem.
// basePath must use os-specific path separator for Open() to work properly.
// If collectFilesFunc is not provided, defaultCollectFilesFunc is used instead, which will collect all files.
func NewLocalFS(basePath string, collectFilesFunc CollectFilesFunc) LocalFS {
	if collectFilesFunc == nil {
		collectFilesFunc = defaultCollectFilesFunc
	}
	return LocalFS{basePath: basePath, collectFilesFunc: collectFilesFunc}
}

// Open opens the specified file on the local filesystem.
// The provided name must be a relative file name that uses os-specific path separators.
// The function returns the corresponding fs.File for accessing the file on the local filesystem.
// If a nil error is returned, the caller should take care of calling Close() the returned fs.File.
// If the file does not exist, ErrFileNotExist is returned.
func (f LocalFS) Open(name string) (fs.File, error) {
	cleanPath, err := util.CleanRelativePath(name)
	if strings.Contains(cleanPath, "..") || err != nil {
		return nil, ErrFileNotExist
	}
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

// Files returns a slice of all the relative file paths on the LocalFS.
// The returned strings can be passed to Open() to open those files.
// The returned strings use os-specific path separator.
func (f LocalFS) Files() ([]string, error) {
	// Accumulate all files into filesMap by calling f.collectFilesFunc, which will write into the accumulator.
	// Those are absolute because filepath.Walk uses absolute file paths.
	absFilePaths := make(map[string]struct{})
	if err := filepath.Walk(f.basePath, f.collectFilesFunc(absFilePaths)); err != nil {
		return nil, fmt.Errorf("walk: %w", err)
	}
	// Convert the accumulator into a slice of relative path strings
	relFiles := make([]string, 0, len(absFilePaths))
	base := f.Base()
	for fn := range absFilePaths {
		relPath, err := filepath.Rel(base, fn)
		if err != nil {
			return nil, err
		}
		clenRelPath, err := util.CleanRelativePath(relPath)
		if strings.Contains(clenRelPath, "..") || err != nil {
			continue
		}
		relFiles = append(relFiles, clenRelPath)
	}
	return relFiles, nil
}

// fsAllowList is a set-like map that contains files that can be accessed from a plugins.FS.
type fsAllowList map[string]struct{}

// isAllowed returns true if the provided path is allowed.
// path is a string accepted by an FS Open() method.
func (a fsAllowList) isAllowed(path string) bool {
	_, ok := a[path]
	return ok
}

// newFSAllowList creates a new fsAllowList from a list of allowed file paths.
func newFSAllowList(files ...string) fsAllowList {
	allowListCopy := fsAllowList(make(map[string]struct{}, len(files)))
	for _, k := range files {
		allowListCopy[k] = struct{}{}
	}
	return allowListCopy
}

// AllowListFS wraps an FS and allows accessing only the files in the allowList.
// This is a more secure implementation of a FS suitable for production environments.
// The keys of the allow list must be in the same format used by the underlying FS' Open() method.
type AllowListFS struct {
	FS

	// allowList is a map of allowed paths (accepted by FS.Open())
	allowList fsAllowList
}

// NewAllowListFS returns a new AllowListFS that can access the files on an underlying FS,
// but only if they are also specified in the provided allowList.
// The keys of the allow list must be in the same format used by the underlying FS' Open() method.
func NewAllowListFS(fs FS, allowList ...string) AllowListFS {
	return AllowListFS{
		FS:        fs,
		allowList: newFSAllowList(allowList...),
	}
}

// Open checks that name is an allowed file and, if so, it returns a fs.File to access it, by calling the
// underlying FS' Open() method.
// If access is denied, the function returns ErrFileNotExist.
func (f AllowListFS) Open(name string) (fs.File, error) {
	// Ensure access to the file is allowed
	if !f.allowList.isAllowed(name) {
		return nil, ErrFileNotExist
	}
	// Use the wrapped FS to access the file
	return f.FS.Open(name)
}

// Files returns a slice of all the file paths in the FS relative to the base path.
// It calls Files() on the underlying FS, and intersects the result with the allow-list.
func (f AllowListFS) Files() ([]string, error) {
	// Get files from the underlying FS
	filesystemFiles, err := f.FS.Files()
	if err != nil {
		return filesystemFiles, err
	}
	// Intersect with allow list
	files := make([]string, 0, len(filesystemFiles))
	for _, fn := range filesystemFiles {
		if !f.allowList.isAllowed(fn) {
			continue
		}
		files = append(files, fn)
	}
	return files, nil
}

// allowListFSNoFiles is a AllowListFS, but it never calls the underlying FS' Files() when calling Files(),
// instead it returns the files only based on the allow-list.
type allowListFSNoFiles AllowListFS

// Files returns the allow-list as a slice of strings.
func (f allowListFSNoFiles) Files() ([]string, error) {
	files := make([]string, 0, len(f.allowList))
	for p := range f.allowList {
		files = append(files, p)
	}
	return files, nil
}

// NewAllowListLocalFSForTests returns a new allowListFSNoFiles (as FS) wrapping a NewLocalFS using a no-op function.
func NewAllowListLocalFSForTests(dir string, files ...string) FS {
	return allowListFSNoFiles(NewAllowListFS(NewLocalFS(dir, emptyCollectFilesFunc), files...))
}

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

// static checks

var (
	_ fs.File = &LocalFile{}

	_ FS = &LocalFS{}
	_ FS = &AllowListFS{}
	_ FS = &allowListFSNoFiles{}
)
