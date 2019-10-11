package main

import (
	"sort"

	"github.com/securego/gosec"
)

type sortBySeverity []*gosec.Issue

func (s sortBySeverity) Len() int { return len(s) }

func (s sortBySeverity) Less(i, j int) bool { return s[i].Severity > s[j].Severity }

func (s sortBySeverity) Swap(i, j int) { s[i], s[j] = s[j], s[i] }

// sortIssues sorts the issues by severity in descending order
func sortIssues(issues []*gosec.Issue) {
	sort.Sort(sortBySeverity(issues))
}
