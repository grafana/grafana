package codegen

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"github.com/google/go-cmp/cmp"
	"github.com/hashicorp/go-multierror"
	"golang.org/x/sync/errgroup"
)

// WriteDiffer is a pseudo-filesystem that supports batch-writing its contents
// to the real filesystem, or batch-comparing its contents to the real
// filesystem. Its intended use is for idiomatic `go generate`-style code
// generators, where it is expected that the results of codegen are committed to
// version control.
//
// In such cases, the normal behavior of a generator is to write files to disk,
// but in CI, that behavior should change to verify that what is already on disk
// is identical to the results of code generation. This allows CI to ensure that
// the results of code generation are always up to date. WriteDiffer supports
// these related behaviors through its Write() and Verify() methods, respectively.
//
// Note that the statelessness of WriteDiffer means that, if a particular input
// to the code generator goes away, it will not notice generated files left
// behind if their inputs are removed.
//
// Files may not be removed once [WriteDiffer.Add]ed. If a path conflict occurs
// when adding a new file or merging another WriteDiffer, an error is returned.
// TODO introduce a search/match system
type WriteDiffer struct {
	mu sync.Mutex
	m  map[string]file
}

type File struct {
	// The relative path to which the generated file should be written.
	RelativePath string
	// Contents of the generated file.
	Data []byte
}

type file struct {
	b     []byte
	owner string
}

// NewWriteDiffer creates a new WriteDiffer, ready for use.
func NewWriteDiffer() *WriteDiffer {
	return &WriteDiffer{
		m: make(map[string]file),
	}
}

// WithOne creates a WriteDiffer with a single file entry.
//
// Useful for the common case of needing to write a single file, and not wanting
// to have to deal with an error.
func WithOne(owner string, f File) *WriteDiffer {
	wd := NewWriteDiffer()
	_ = wd.add(owner, f)
	return wd
}

type writeSlice []struct {
	path     string
	contents []byte
}

// Verify checks the contents of each file against the filesystem. It emits an error
// if any of its contained files differ.
func (wd *WriteDiffer) Verify() error {
	wd.mu.Lock()
	defer wd.mu.Unlock()
	var result error

	for _, item := range wd.toSlice() {
		if _, err := os.Stat(item.path); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				result = multierror.Append(result, fmt.Errorf("%s: generated file should exist, but does not", item.path))
			} else {
				result = multierror.Append(result, fmt.Errorf("%s: could not stat generated file: %w", item.path, err))
			}
			continue
		}

		ob, err := os.ReadFile(item.path)
		if err != nil {
			result = multierror.Append(result, fmt.Errorf("%s: %w", item.path, err))
			continue
		}
		dstr := cmp.Diff(string(ob), string(item.contents))
		if dstr != "" {
			result = multierror.Append(result, fmt.Errorf("%s would have changed:\n\n%s", item.path, dstr))
		}
	}

	return result
}

// Write writes all of the files to their indicated paths.
// TODO try to undo already-written files on error (only best effort, it's not possible to guarantee)
func (wd *WriteDiffer) Write(ctx context.Context) error {
	wd.mu.Lock()
	defer wd.mu.Unlock()
	g, _ := errgroup.WithContext(ctx)
	g.SetLimit(12)

	for _, item := range wd.toSlice() {
		it := item
		g.Go(func() error {
			err := os.MkdirAll(filepath.Dir(it.path), os.ModePerm)
			if err != nil {
				return fmt.Errorf("%s: failed to ensure parent directory exists: %w", it.path, err)
			}

			if err := os.WriteFile(it.path, it.contents, 0644); err != nil {
				return fmt.Errorf("%s: error while writing file: %w", it.path, err)
			}
			return nil
		})
	}

	return g.Wait()
}

func (wd *WriteDiffer) toSlice() writeSlice {
	sl := make(writeSlice, 0, len(wd.m))
	type ws struct {
		path     string
		contents []byte
	}

	for k, v := range wd.m {
		sl = append(sl, ws{
			path:     k,
			contents: v.b,
		})
	}

	sort.Slice(sl, func(i, j int) bool {
		return sl[i].path < sl[j].path
	})

	return sl
}

// Add adds one or more files to the WriteDiffer. An error is returned if any of
// the provided files would conflict a file already declared added to the
// WriteDiffer.
//
// owner is an opaque string that identifies the creator of these files. It is
// used solely in to make path conflict errors more informative.
func (wd *WriteDiffer) Add(owner string, flist ...File) error {
	wd.mu.Lock()
	err := wd.add(owner, flist...)
	wd.mu.Unlock()
	return err
}

func (wd *WriteDiffer) add(owner string, flist ...File) error {
	var result error
	for _, f := range flist {
		if rf, has := wd.m[f.RelativePath]; has {
			result = multierror.Append(result, fmt.Errorf("writediffer cannot create %s for %q, already created for %q", f.RelativePath, owner, rf.owner))
		}
	}
	if result != nil {
		return result
	}

	for _, f := range flist {
		wd.m[f.RelativePath] = file{b: f.Data, owner: owner}
	}
	return nil
}

// Merge combines all the entries from the provided WriteDiffer into the callee
// WriteDiffer. Duplicate paths result in an error.
func (wd *WriteDiffer) Merge(wd2 *WriteDiffer) error {
	wd.mu.Lock()
	defer wd.mu.Unlock()
	var result error

	for k, inf := range wd2.m {
		result = multierror.Append(result, wd.add(inf.owner, File{RelativePath: k, Data: inf.b}))
	}

	return result
}
