package printers

import (
	"context"
	"crypto/md5" //nolint:gosec
	"encoding/json"
	"fmt"

	"github.com/golangci/golangci-lint/pkg/logutils"
	"github.com/golangci/golangci-lint/pkg/result"
)

// CodeClimateIssue is a subset of the Code Climate spec - https://github.com/codeclimate/spec/blob/master/SPEC.md#data-types
// It is just enough to support GitLab CI Code Quality - https://docs.gitlab.com/ee/user/project/merge_requests/code_quality.html
type CodeClimateIssue struct {
	Description string `json:"description"`
	Fingerprint string `json:"fingerprint"`
	Location    struct {
		Path  string `json:"path"`
		Lines struct {
			Begin int `json:"begin"`
		} `json:"lines"`
	} `json:"location"`
}

type CodeClimate struct {
}

func NewCodeClimate() *CodeClimate {
	return &CodeClimate{}
}

func (p CodeClimate) Print(ctx context.Context, issues []result.Issue) error {
	allIssues := []CodeClimateIssue{}
	for _, i := range issues {
		var issue CodeClimateIssue
		issue.Description = i.FromLinter + ": " + i.Text
		issue.Location.Path = i.Pos.Filename
		issue.Location.Lines.Begin = i.Pos.Line

		// Need a checksum of the issue, so we use MD5 of the filename, text, and first line of source
		hash := md5.New() //nolint:gosec
		_, _ = hash.Write([]byte(i.Pos.Filename + i.Text + i.SourceLines[0]))
		issue.Fingerprint = fmt.Sprintf("%X", hash.Sum(nil))

		allIssues = append(allIssues, issue)
	}

	outputJSON, err := json.Marshal(allIssues)
	if err != nil {
		return err
	}

	fmt.Fprint(logutils.StdOut, string(outputJSON))
	return nil
}
