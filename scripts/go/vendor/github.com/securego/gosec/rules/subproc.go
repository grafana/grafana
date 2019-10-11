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

type subprocess struct {
	gosec.MetaData
	gosec.CallList
}

func (r *subprocess) ID() string {
	return r.MetaData.ID
}

// TODO(gm) The only real potential for command injection with a Go project
// is something like this:
//
// syscall.Exec("/bin/sh", []string{"-c", tainted})
//
// E.g. Input is correctly escaped but the execution context being used
// is unsafe. For example:
//
// syscall.Exec("echo", "foobar" + tainted)
func (r *subprocess) Match(n ast.Node, c *gosec.Context) (*gosec.Issue, error) {
	if node := r.ContainsCallExpr(n, c, false); node != nil {
		for _, arg := range node.Args {
			if ident, ok := arg.(*ast.Ident); ok {
				obj := c.Info.ObjectOf(ident)
				if _, ok := obj.(*types.Var); ok && !gosec.TryResolve(ident, c) {
					return gosec.NewIssue(c, n, r.ID(), "Subprocess launched with variable", gosec.Medium, gosec.High), nil
				}
			}
		}
		return gosec.NewIssue(c, n, r.ID(), "Subprocess launching should be audited", gosec.Low, gosec.High), nil
	}
	return nil, nil
}

// NewSubproc detects cases where we are forking out to an external process
func NewSubproc(id string, conf gosec.Config) (gosec.Rule, []ast.Node) {
	rule := &subprocess{gosec.MetaData{ID: id}, gosec.NewCallList()}
	rule.Add("os/exec", "Command")
	rule.Add("os/exec", "CommandContext")
	rule.Add("syscall", "Exec")
	return rule, []ast.Node{(*ast.CallExpr)(nil)}
}
