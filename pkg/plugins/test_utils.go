package plugins

import (
	"bytes"
	"io/fs"
	"os"
	"time"
)

var (
	_ FS          = &inMemoryFS{}
	_ fs.File     = &inMemoryFile{}
	_ fs.FileInfo = &inMemoryFileInfo{}
)

// inMemoryFS is an FS that stores files in-memory.
type inMemoryFS struct {
	files map[string][]byte
}

// NewInMemoryFS returns a new FS with the specified files and content.
// The provided value is a map from file name (keys) to file content (values).
func NewInMemoryFS(files map[string][]byte) FS {
	return &inMemoryFS{files: files}
}

func (f inMemoryFS) Base() string {
	return ""
}

func (f inMemoryFS) Files() ([]string, error) {
	fps := make([]string, 0, len(f.files))
	for fn := range f.files {
		fps = append(fps, fn)
	}
	return fps, nil
}

func (f inMemoryFS) Open(fn string) (fs.File, error) {
	if _, ok := f.files[fn]; !ok {
		return nil, ErrFileNotExist
	}
	return &inMemoryFile{path: fn, reader: bytes.NewReader(f.files[fn])}, nil
}

// NewFakeFS returns a new FS that always returns ErrFileNotExist when trying to Open() and empty Files().
func NewFakeFS() FS {
	return NewInMemoryFS(nil)
}

// inMemoryFile is a fs.File whose content is stored in memory.
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
