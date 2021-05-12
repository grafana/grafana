package schemaloader

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
	"time"
)

type dir struct {
	name    string
	modTime time.Time
	// we can have files or folders under one dir
	children map[string]fs.DirEntry
	// for walkdir
	idx int
}

func (d *dir) Read(p []byte) (int, error) {
	return 0, &fs.PathError{
		Op:   "read",
		Path: d.name,
		Err:  errors.New("is directory"),
	}
}

func (d *dir) Stat() (fs.FileInfo, error) {
	return d, nil
}

func (d *dir) Close() error {
	return nil
}

// ReadDir 实现 fs.ReadDirFile 接口，方便遍历目录
func (d *dir) ReadDir(n int) ([]fs.DirEntry, error) {
	names := make([]string, 0, len(d.children))
	for name := range d.children {
		names = append(names, name)
	}

	totalEntry := len(names)
	if n <= 0 {
		n = totalEntry
	}

	dirEntries := make([]fs.DirEntry, 0, n)
	for i := d.idx; i < n && i < totalEntry; i++ {
		name := names[i]
		child := d.children[name]

		f, isFile := child.(*file)
		if isFile {
			dirEntries = append(dirEntries, f)
		} else {
			dirEntry := child.(*dir)
			dirEntries = append(dirEntries, dirEntry)
		}

		d.idx = i
	}

	return dirEntries, nil
}

func (d *dir) Name() string {
	return d.name
}

func (d *dir) Size() int64 {
	return 0
}

func (d *dir) Mode() fs.FileMode {
	return fs.ModeDir | 0444
}

func (d *dir) ModTime() time.Time {
	return d.modTime
}

func (d *dir) IsDir() bool {
	return true
}

func (d *dir) Sys() interface{} {
	return nil
}

func (d *dir) Type() fs.FileMode {
	return d.Mode()
}

func (d *dir) Info() (fs.FileInfo, error) {
	return d, nil
}

type file struct {
	name    string
	content *bytes.Buffer
	modTime time.Time
	closed  bool
}

func (f *file) Read(p []byte) (int, error) {
	if f.closed {
		return 0, errors.New("file closed")
	}

	return f.content.Read(p)
}

func (f *file) Stat() (fs.FileInfo, error) {
	if f.closed {
		return nil, errors.New("file closed")
	}

	return f, nil
}

// Close could be called several times
func (f *file) Close() error {
	f.closed = true
	return nil
}

// implement fs.FileInfo interface

func (f *file) Name() string {
	return f.name
}

func (f *file) Size() int64 {
	return int64(f.content.Len())
}

func (f *file) Mode() fs.FileMode {
	return 0444
}

func (f *file) ModTime() time.Time {
	return f.modTime
}

func (f *file) IsDir() bool {
	return false
}

func (f *file) Sys() interface{} {
	return nil
}

// file should also fullfill fs.DirEntry interface

func (f *file) Type() fs.FileMode {
	return f.Mode()
}

func (f *file) Info() (fs.FileInfo, error) {
	return f, nil
}

type InstanceFS struct {
	rootDir *dir
}

func NewInstanceFS() *InstanceFS {
	return &InstanceFS{
		rootDir: &dir{
			children: make(map[string]fs.DirEntry),
		},
	}
}
func (fsys *InstanceFS) Open(name string) (fs.File, error) {
	// verify name is a valid path
	if !fs.ValidPath(name) {
		return nil, &fs.PathError{
			Op:   "open",
			Path: name,
			Err:  fs.ErrInvalid,
		}
	}

	// deal with the root
	if name == "." || name == "" {
		// reset index for walkdir
		fsys.rootDir.idx = 0
		return fsys.rootDir, nil
	}

	// search with the name - parse dir and file name
	cur := fsys.rootDir
	parts := strings.Split(name, "/")
	for i, part := range parts {
		// return error if not exists
		child := cur.children[part]
		if child == nil {
			return nil, &fs.PathError{
				Op:   "open",
				Path: name,
				Err:  fs.ErrNotExist,
			}
		}

		// check whether it is a file
		if f, ok := child.(*file); ok {
			// the filename is the last part of name
			if i == len(parts)-1 {
				return f, nil
			}

			return nil, &fs.PathError{
				Op:   "open",
				Path: name,
				Err:  fs.ErrNotExist,
			}
		}

		// check if it is dir
		d, ok := child.(*dir)
		if !ok {
			return nil, &fs.PathError{
				Op:   "open",
				Path: name,
				Err:  errors.New("not a directory"),
			}
		}
		// reset to 0
		d.idx = 0
		cur = d
	}

	return cur, nil
}

// MkdirAll is not required, but this is used to make dir
func (fsys *InstanceFS) MkdirAll(path string) error {
	if !fs.ValidPath(path) {
		return errors.New("invalid path")
	}

	if path == "." {
		return nil
	}

	cur := fsys.rootDir
	parts := strings.Split(path, "/")
	for _, part := range parts {
		child := cur.children[part]
		if child == nil {
			childDir := &dir{
				name:     part,
				modTime:  time.Now(),
				children: make(map[string]fs.DirEntry),
			}
			cur.children[part] = childDir
			cur = childDir
		} else {
			childDir, ok := child.(*dir)
			if !ok {
				return fmt.Errorf("%s is not directory", part)
			}

			cur = childDir
		}
	}

	return nil
}

// WriteFile is not required, it is used to write file into virtual file system
func (fsys *InstanceFS) WriteFile(name, content string) error {
	if !fs.ValidPath(name) {
		return &fs.PathError{
			Op:   "write",
			Path: name,
			Err:  fs.ErrInvalid,
		}
	}

	var err error
	dir := fsys.rootDir

	path := filepath.Dir(name)
	if path != "." {
		dir, err = fsys.getDir(path)
		if err != nil {
			return err
		}
	}
	filename := filepath.Base(name)

	dir.children[filename] = &file{
		name:    filename,
		content: bytes.NewBufferString(content),
		modTime: time.Now(),
	}

	return nil
}

// getDir to get dir through path
func (fsys *InstanceFS) getDir(path string) (*dir, error) {
	parts := strings.Split(path, "/")

	cur := fsys.rootDir
	for _, part := range parts {
		child := cur.children[part]
		if child == nil {
			return nil, fmt.Errorf("%s is not exists", path)
		}

		childDir, ok := child.(*dir)
		if !ok {
			return nil, fmt.Errorf("%s is not directory", path)
		}

		cur = childDir
	}

	return cur, nil
}
