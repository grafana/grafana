package cuectx

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"strings"
)

func makePrefix(fsys fs.FS, dir string) (fs.FS, error) {
	if !fs.ValidPath(dir) {
		return nil, &fs.PathError{Op: "prefix", Path: dir, Err: errors.New("invalid name")}
	}
	if dir == "." {
		return fsys, nil
	}
	if !strings.HasSuffix(dir, string(os.PathSeparator)) {
		dir += string(os.PathSeparator)
	}
	return &preFS{fsys, dir}, nil
}

type preFS struct {
	fsys fs.FS
	dir  string
}

// fullName maps name to the fully-qualified name dir/name.
func (f *preFS) fullName(op string, name string) (string, error) {
	if !fs.ValidPath(name) {
		return "", &fs.PathError{Op: op, Path: name, Err: errors.New("invalid name")}
	}
	return path.Join(f.dir, name), nil
}

// shorten maps name, which should start with f.dir, back to the suffix after f.dir.
func (f *preFS) shorten(name string) (rel string, ok bool) {
	if name == f.dir {
		return ".", true
	}
	if len(name) >= len(f.dir)+2 && name[len(f.dir)] == '/' && name[:len(f.dir)] == f.dir {
		return name[len(f.dir)+1:], true
	}
	return "", false
}

// fixErr shortens any reported names in PathErrors by stripping f.dir.
func (f *preFS) fixErr(err error) error {
	if e, ok := err.(*fs.PathError); ok {
		if short, ok := f.shorten(e.Path); ok {
			e.Path = short
		}
	}
	return err
}

func (f *preFS) Open(name string) (fs.File, error) {
	full, err := f.fullName("open", name)
	if err != nil {
		return nil, err
	}
	file, err := f.fsys.Open(full)
	return file, f.fixErr(err)
}

func (f *preFS) ReadDir(name string) ([]fs.DirEntry, error) {
	full, err := f.fullName("read", name)
	if err != nil {
		return nil, err
	}
	dir, err := fs.ReadDir(f.fsys, full)
	return dir, f.fixErr(err)
}

func (f *preFS) ReadFile(name string) ([]byte, error) {
	full, err := f.fullName("read", name)
	if err != nil {
		return nil, err
	}
	data, err := fs.ReadFile(f.fsys, full)
	return data, f.fixErr(err)
}

func (f *preFS) Glob(pattern string) ([]string, error) {
	// Check pattern is well-formed.
	if _, err := path.Match(pattern, ""); err != nil {
		return nil, err
	}
	if pattern == "." {
		return []string{"."}, nil
	}

	full := f.dir + "/" + pattern
	list, err := fs.Glob(f.fsys, full)
	for i, name := range list {
		name, ok := f.shorten(name)
		if !ok {
			return nil, fmt.Errorf("invalid result from inner fsys Glob: %s not in %s ", name, f.dir)
		}
		list[i] = name
	}
	return list, f.fixErr(err)
}

func (f *preFS) Sub(dir string) (fs.FS, error) {
	if dir == "." {
		return f, nil
	}
	full, err := f.fullName("sub", dir)
	if err != nil {
		return nil, err
	}
	return &preFS{f.fsys, full}, nil
}
