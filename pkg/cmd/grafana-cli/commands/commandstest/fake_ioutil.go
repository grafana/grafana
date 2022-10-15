package commandstest

import (
	"io/fs"
	"os"
	"time"
)

type FakeIoUtil struct {
	FakeReadDir     []fs.DirEntry
	FakeIsDirectory bool
}

func (util *FakeIoUtil) Stat(path string) (os.FileInfo, error) {
	return &FakeFileInfo{IsDirectory: util.FakeIsDirectory}, nil
}

func (util *FakeIoUtil) RemoveAll(path string) error {
	return nil
}

func (util *FakeIoUtil) ReadDir(path string) ([]fs.DirEntry, error) {
	return util.FakeReadDir, nil
}

func (*FakeIoUtil) ReadFile(filename string) ([]byte, error) {
	return make([]byte, 0), nil
}

type FakeFileInfo struct {
	IsDirectory bool
}

func (ffi *FakeFileInfo) IsDir() bool {
	return ffi.IsDirectory
}

func (ffi FakeFileInfo) Size() int64 {
	return 1
}

func (ffi FakeFileInfo) Mode() os.FileMode {
	return 0777
}

func (ffi FakeFileInfo) Name() string {
	return ""
}

func (ffi FakeFileInfo) ModTime() time.Time {
	return time.Time{}
}

func (ffi FakeFileInfo) Sys() interface{} {
	return nil
}
