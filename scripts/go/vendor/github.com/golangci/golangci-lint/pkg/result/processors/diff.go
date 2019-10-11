package processors

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"strings"

	"github.com/golangci/revgrep"

	"github.com/golangci/golangci-lint/pkg/result"
)

type Diff struct {
	onlyNew       bool
	fromRev       string
	patchFilePath string
	patch         string
}

var _ Processor = Diff{}

func NewDiff(onlyNew bool, fromRev, patchFilePath string) *Diff {
	return &Diff{
		onlyNew:       onlyNew,
		fromRev:       fromRev,
		patchFilePath: patchFilePath,
		patch:         os.Getenv("GOLANGCI_DIFF_PROCESSOR_PATCH"),
	}
}

func (p Diff) Name() string {
	return "diff"
}

func (p Diff) Process(issues []result.Issue) ([]result.Issue, error) {
	if !p.onlyNew && p.fromRev == "" && p.patchFilePath == "" && p.patch == "" { // no need to work
		return issues, nil
	}

	var patchReader io.Reader
	if p.patchFilePath != "" {
		patch, err := ioutil.ReadFile(p.patchFilePath)
		if err != nil {
			return nil, fmt.Errorf("can't read from patch file %s: %s", p.patchFilePath, err)
		}
		patchReader = bytes.NewReader(patch)
	} else if p.patch != "" {
		patchReader = strings.NewReader(p.patch)
	}

	c := revgrep.Checker{
		Patch:        patchReader,
		RevisionFrom: p.fromRev,
	}
	if err := c.Prepare(); err != nil {
		return nil, fmt.Errorf("can't prepare diff by revgrep: %s", err)
	}

	return transformIssues(issues, func(i *result.Issue) *result.Issue {
		hunkPos, isNew := c.IsNewIssue(i)
		if !isNew {
			return nil
		}

		newI := *i
		newI.HunkPos = hunkPos
		return &newI
	}), nil
}

func (Diff) Finish() {}
