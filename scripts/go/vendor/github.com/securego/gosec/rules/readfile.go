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
	"go/types"

	"github.com/securego/gosec"
)

type readfile struct {
	gosec.MetaData
	gosec.CallList
	pathJoin gosec.CallList
}

// ID returns the identifier for this rule
func (r *readfile) ID() string {
	return r.MetaData.ID
}

// isJoinFunc checks if there is a filepath.Join or other join function
func (r *readfile) isJoinFunc(n ast.Node, c *gosec.Context) bool {
	if call := r.pathJoin.ContainsCallExpr(n, c, false); call != nil {
		for _, arg := range call.Args {
			// edge case: check if one of the args is a BinaryExpr
			if binExp, ok := arg.(*ast.BinaryExpr); ok {
				// iterate and resolve all found identities from the BinaryExpr
				if _, ok := gosec.FindVarIdentities(binExp, c); ok {
					return true
				}
			}

			// try and resolve identity
			if ident, ok := arg.(*ast.Ident); ok {
				obj := c.Info.ObjectOf(ident)
				if _, ok := obj.(*types.Var); ok && !gosec.TryResolve(ident, c) {
					return true
				}
			}
		}
	}
	return false
}

// Match inspects AST nodes to determine if the match the methods `os.Open` or `ioutil.ReadFile`
func (r *readfile) Match(n ast.Node, c *gosec.Context) (*gosec.Issue, error) {
	if node := r.ContainsCallExpr(n, c, false); node != nil {
		for _, arg := range node.Args {
			// handles path joining functions in Arg
			// eg. os.Open(filepath.Join("/tmp/", file))
			if callExpr, ok := arg.(*ast.CallExpr); ok {
				if r.isJoinFunc(callExpr, c) {
					return gosec.NewIssue(c, n, r.ID(), r.What, r.Severity, r.Confidence), nil
				}
			}
			// handles binary string concatenation eg. ioutil.Readfile("/tmp/" + file + "/blob")
			if binExp, ok := arg.(*ast.BinaryExpr); ok {
				// resolve all found identities from the BinaryExpr
				if _, ok := gosec.FindVarIdentities(binExp, c); ok {
					return gosec.NewIssue(c, n, r.ID(), r.What, r.Severity, r.Confidence), nil
				}
			}

			if ident, ok := arg.(*ast.Ident); ok {
				obj := c.Info.ObjectOf(ident)
				if _, ok := obj.(*types.Var); ok && !gosec.TryResolve(ident, c) {
					return gosec.NewIssue(c, n, r.ID(), r.What, r.Severity, r.Confidence), nil
				}
			}
		}
	}
	return nil, nil
}

// NewReadFile detects cases where we read files
func NewReadFile(id string, conf gosec.Config) (gosec.Rule, []ast.Node) {
	rule := &readfile{
		pathJoin: gosec.NewCallList(),
		CallList: gosec.NewCallList(),
		MetaData: gosec.MetaData{
			ID:         id,
			What:       "Potential file inclusion via variable",
			Severity:   gosec.Medium,
			Confidence: gosec.High,
		},
	}
	rule.pathJoin.Add("path/filepath", "Join")
	rule.pathJoin.Add("path", "Join")
	rule.Add("io/ioutil", "ReadFile")
	rule.Add("os", "Open")
	return rule, []ast.Node{(*ast.CallExpr)(nil)}
}
