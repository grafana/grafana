package codegen

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"

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
// TODO introduce a search/match system
type WriteDiffer map[string][]byte

func NewWriteDiffer() WriteDiffer {
	return WriteDiffer(make(map[string][]byte))
}

type writeSlice []struct {
	path     string
	contents []byte
}

// Verify checks the contents of each file against the filesystem. It emits an error
// if any of its contained files differ.
func (wd WriteDiffer) Verify() error {
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

		f, err := os.Open(filepath.Clean(item.path))
		if err != nil {
			result = multierror.Append(result, fmt.Errorf("%s: %w", item.path, err))
			continue
		}

		ob, err := io.ReadAll(f)
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
func (wd WriteDiffer) Write() error {
	g, _ := errgroup.WithContext(context.TODO())
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

func (wd WriteDiffer) toSlice() writeSlice {
	sl := make(writeSlice, 0, len(wd))
	type ws struct {
		path     string
		contents []byte
	}

	for k, v := range wd {
		sl = append(sl, ws{
			path:     k,
			contents: v,
		})
	}

	sort.Slice(sl, func(i, j int) bool {
		return sl[i].path < sl[j].path
	})

	return sl
}

// Merge combines all the entries from the provided WriteDiffer into the callee
// WriteDiffer. Duplicate paths result in an error.
func (wd WriteDiffer) Merge(wd2 WriteDiffer) error {
	for k, v := range wd2 {
		if _, has := wd[k]; has {
			return fmt.Errorf("path %s already exists in write differ", k)
		}
		wd[k] = v
	}

	return nil
}
