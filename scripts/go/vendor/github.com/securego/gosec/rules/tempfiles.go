// (c) Copyright 2016 Hewlett Packard Enterprise Development LP
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package rules

import (
	"go/ast"
	"regexp"

	"github.com/securego/gosec"
)

type badTempFile struct {
	gosec.MetaData
	calls gosec.CallList
	args  *regexp.Regexp
}

func (t *badTempFile) ID() string {
	return t.MetaData.ID
}

func (t *badTempFile) Match(n ast.Node, c *gosec.Context) (gi *gosec.Issue, err error) {
	if node := t.calls.ContainsCallExpr(n, c, false); node != nil {
		if arg, e := gosec.GetString(node.Args[0]); t.args.MatchString(arg) && e == nil {
			return gosec.NewIssue(c, n, t.ID(), t.What, t.Severity, t.Confidence), nil
		}
	}
	return nil, nil
}

// NewBadTempFile detects direct writes to predictable path in temporary directory
func NewBadTempFile(id string, conf gosec.Config) (gosec.Rule, []ast.Node) {
	calls := gosec.NewCallList()
	calls.Add("io/ioutil", "WriteFile")
	calls.Add("os", "Create")
	return &badTempFile{
		calls: calls,
		args:  regexp.MustCompile(`^/tmp/.*$|^/var/tmp/.*$`),
		MetaData: gosec.MetaData{
			ID:         id,
			Severity:   gosec.Medium,
			Confidence: gosec.High,
			What:       "File creation in shared tmp directory without using ioutil.Tempfile",
		},
	}, []ast.Node{(*ast.CallExpr)(nil)}
}
