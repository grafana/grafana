package processors

import (
	"fmt"

	"github.com/golangci/golangci-lint/pkg/result"
)

func filterIssues(issues []result.Issue, filter func(i *result.Issue) bool) []result.Issue {
	retIssues := make([]result.Issue, 0, len(issues))
	for _, i := range issues {
		i := i
		if filter(&i) {
			retIssues = append(retIssues, i)
		}
	}

	return retIssues
}

func filterIssuesErr(issues []result.Issue, filter func(i *result.Issue) (bool, error)) ([]result.Issue, error) {
	retIssues := make([]result.Issue, 0, len(issues))
	for _, i := range issues {
		i := i
		ok, err := filter(&i)
		if err != nil {
			return nil, fmt.Errorf("can't filter issue %#v: %s", i, err)
		}

		if ok {
			retIssues = append(retIssues, i)
		}
	}

	return retIssues, nil
}

func transformIssues(issues []result.Issue, transform func(i *result.Issue) *result.Issue) []result.Issue {
	retIssues := make([]result.Issue, 0, len(issues))
	for _, i := range issues {
		i := i
		newI := transform(&i)
		if newI != nil {
			retIssues = append(retIssues, *newI)
		}
	}

	return retIssues
}
