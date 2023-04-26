package kindsysreport

import (
	"os"
	"path/filepath"

	"github.com/hmarr/codeowners"
)

type CodeOwnersFinder struct {
	ruleset codeowners.Ruleset
}

func NewCodeOwnersFinder(groot string) (CodeOwnersFinder, error) {
	//nolint:gosec
	file, err := os.Open(filepath.Join(groot, ".github", "CODEOWNERS"))
	if err != nil {
		return CodeOwnersFinder{}, err
	}

	ruleset, err := codeowners.ParseFile(file)
	if err != nil {
		return CodeOwnersFinder{}, err
	}

	return CodeOwnersFinder{
		ruleset: ruleset,
	}, nil
}

func (f CodeOwnersFinder) FindFor(pp ...string) ([]string, error) {
	if len(f.ruleset) == 0 {
		return nil, nil
	}

	// Set, to avoid duplicates
	m := make(map[string]struct{})

	for _, p := range pp {
		r, err := f.ruleset.Match(p)
		if err != nil {
			return nil, err
		}

		// No rule found for path p
		if r == nil {
			continue
		}

		for _, o := range r.Owners {
			m[o.Value] = struct{}{}
		}
	}

	result := make([]string, 0, len(m))
	for k := range m {
		result = append(result, k)
	}

	return result, nil
}
