package codegen

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana"
)

const (
	// VarVerify is the name of the environment variable that determines the result
	// of [ShouldVerify].
	VarVerify = "CODEGEN_VERIFY"

	// VarSkipHash is the name of the environment variables that determines the result
	// of [ShouldSkipInputHashing].
	VarSkipHash = "CODEGEN_SKIPHASH"
)

var (
	codegenVerify   bool
	codegenSkipHash bool
)

func init() {
	_, codegenVerify = os.LookupEnv(VarVerify)
	_, codegenSkipHash = os.LookupEnv(VarSkipHash)
}

// ShouldVerify indicates whether the results of CUE-based codegen should be written
// to disk (false), or compared against existing disk state (false).
//
// The return value is determined by the env var for codegen verification (see
// [VarVerify]). Setting this var will cause code generation to compare the
// results of code generation against existing disk state, rather than updating
// it.
func ShouldVerify() bool {
	return codegenVerify
}

// ShouldSkipInputHashing indicates whether hashing of CUE-based code
// generation inputs should be skipped.
//
// If input hashing is not skipped, and the persisted hash digest is the
// same as the input hash digest, then code generation is skipped.
//
// The return value is determined by env var (see [VarSkipHash]). Input
// hashing is always skipped if verification is requested ([ShouldVerify]
// returns true)
func ShouldSkipInputHashing() bool {
	return codegenVerify || codegenSkipHash
}

// HashCUEInputs runs the contents of the set of .cue input files contained in
// the main [grafana.CueSchemaFS] matched by the provided shell glob patterns
// (see [doublestar.Match]) through a SHA256 hash, and returns the resulting
// digest.
//
// Files are sorted prior to hashing, so glob pattern ordering has no effect on
// digest output.
//
// An error is returned if no files are matched by the input globs.
func HashCUEInputs(globs ...string) ([]byte, error) {
	var all []string
	for _, glob := range globs {
		match, err := doublestar.Glob(grafana.CueSchemaFS, filepath.ToSlash(glob))
		if err != nil {
			return nil, fmt.Errorf("error for glob %q: %w", glob, err)
		}
		all = append(all, match...)
	}

	if len(all) == 0 {
		return nil, fmt.Errorf("no grafana.CueFS files matched globs:\n\t%s", strings.Join(all, "\n\t"))
	}

	sort.Strings(all)
	check := make(map[string]bool)
	h := sha256.New()
	for _, fname := range all {
		name := filepath.ToSlash(fname)
		if !check[name] {
			check[name] = true
			byt, err := fs.ReadFile(grafana.CueSchemaFS, fname)
			if err != nil {
				return nil, fmt.Errorf("error reading %s from grafana.CueFS: %w", fname, err)
			}
			h.Write([]byte(name))
			h.Write(byt)
		}
	}

	return []byte(hex.EncodeToString(h.Sum(nil))), nil
}

type MainGenerator[T codejen.Input] struct {
	// DigestPath is the path to the main digest file for a generator
	DigestPath string

	// CUEInputGlobs is the set of glob patterns (see [doublestar.Match]) that
	// identify the set of CUE inputs for this generator.
	CUEInputGlobs []string

	Pipeline *codejen.JennyList[T]
}
