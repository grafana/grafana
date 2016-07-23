package commandstest

import (
	"os"
	"time"
)

type FakeIoUtil struct {
	FakeReadDir     []os.FileInfo
	FakeIsDirectory bool
}

func (util *FakeIoUtil) Stat(path string) (os.FileInfo, error) {
	return &FakeFileInfo{IsDirectory: util.FakeIsDirectory}, nil
}

func (util *FakeIoUtil) RemoveAll(path string) error {
	return nil
}

func (util *FakeIoUtil) ReadDir(path string) ([]os.FileInfo, error) {
	return util.FakeReadDir, nil
}

func (i *FakeIoUtil) ReadFile(filename string) ([]byte, error) {
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
