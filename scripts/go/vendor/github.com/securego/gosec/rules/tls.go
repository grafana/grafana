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

//go:generate tlsconfig

package rules

import (
	"fmt"
	"go/ast"

	"github.com/securego/gosec"
)

type insecureConfigTLS struct {
	gosec.MetaData
	MinVersion   int16
	MaxVersion   int16
	requiredType string
	goodCiphers  []string
}

func (t *insecureConfigTLS) ID() string {
	return t.MetaData.ID
}

func stringInSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}

func (t *insecureConfigTLS) processTLSCipherSuites(n ast.Node, c *gosec.Context) *gosec.Issue {

	if ciphers, ok := n.(*ast.CompositeLit); ok {
		for _, cipher := range ciphers.Elts {
			if ident, ok := cipher.(*ast.SelectorExpr); ok {
				if !stringInSlice(ident.Sel.Name, t.goodCiphers) {
					err := fmt.Sprintf("TLS Bad Cipher Suite: %s", ident.Sel.Name)
					return gosec.NewIssue(c, ident, t.ID(), err, gosec.High, gosec.High)
				}
			}
		}
	}
	return nil
}

func (t *insecureConfigTLS) processTLSConfVal(n *ast.KeyValueExpr, c *gosec.Context) *gosec.Issue {
	if ident, ok := n.Key.(*ast.Ident); ok {
		switch ident.Name {

		case "InsecureSkipVerify":
			if node, ok := n.Value.(*ast.Ident); ok {
				if node.Name != "false" {
					return gosec.NewIssue(c, n, t.ID(), "TLS InsecureSkipVerify set true.", gosec.High, gosec.High)
				}
			} else {
				// TODO(tk): symbol tab look up to get the actual value
				return gosec.NewIssue(c, n, t.ID(), "TLS InsecureSkipVerify may be true.", gosec.High, gosec.Low)
			}

		case "PreferServerCipherSuites":
			if node, ok := n.Value.(*ast.Ident); ok {
				if node.Name == "false" {
					return gosec.NewIssue(c, n, t.ID(), "TLS PreferServerCipherSuites set false.", gosec.Medium, gosec.High)
				}
			} else {
				// TODO(tk): symbol tab look up to get the actual value
				return gosec.NewIssue(c, n, t.ID(), "TLS PreferServerCipherSuites may be false.", gosec.Medium, gosec.Low)
			}

		case "MinVersion":
			if ival, ierr := gosec.GetInt(n.Value); ierr == nil {
				if (int16)(ival) < t.MinVersion {
					return gosec.NewIssue(c, n, t.ID(), "TLS MinVersion too low.", gosec.High, gosec.High)
				}
				// TODO(tk): symbol tab look up to get the actual value
				return gosec.NewIssue(c, n, t.ID(), "TLS MinVersion may be too low.", gosec.High, gosec.Low)
			}

		case "MaxVersion":
			if ival, ierr := gosec.GetInt(n.Value); ierr == nil {
				if (int16)(ival) < t.MaxVersion {
					return gosec.NewIssue(c, n, t.ID(), "TLS MaxVersion too low.", gosec.High, gosec.High)
				}
				// TODO(tk): symbol tab look up to get the actual value
				return gosec.NewIssue(c, n, t.ID(), "TLS MaxVersion may be too low.", gosec.High, gosec.Low)
			}

		case "CipherSuites":
			if ret := t.processTLSCipherSuites(n.Value, c); ret != nil {
				return ret
			}

		}

	}
	return nil
}

func (t *insecureConfigTLS) Match(n ast.Node, c *gosec.Context) (*gosec.Issue, error) {
	if complit, ok := n.(*ast.CompositeLit); ok && complit.Type != nil {
		actualType := c.Info.TypeOf(complit.Type)
		if actualType != nil && actualType.String() == t.requiredType {
			for _, elt := range complit.Elts {
				if kve, ok := elt.(*ast.KeyValueExpr); ok {
					issue := t.processTLSConfVal(kve, c)
					if issue != nil {
						return issue, nil
					}
				}
			}
		}
	}
	return nil, nil
}
