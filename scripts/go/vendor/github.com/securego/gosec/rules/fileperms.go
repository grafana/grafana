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
	"fmt"
	"go/ast"
	"strconv"

	"github.com/securego/gosec"
)

type filePermissions struct {
	gosec.MetaData
	mode  int64
	pkg   string
	calls []string
}

func (r *filePermissions) ID() string {
	return r.MetaData.ID
}

func getConfiguredMode(conf map[string]interface{}, configKey string, defaultMode int64) int64 {
	var mode = defaultMode
	if value, ok := conf[configKey]; ok {
		switch value := value.(type) {
		case int64:
			mode = value
		case string:
			if m, e := strconv.ParseInt(value, 0, 64); e != nil {
				mode = defaultMode
			} else {
				mode = m
			}
		}
	}
	return mode
}

func (r *filePermissions) Match(n ast.Node, c *gosec.Context) (*gosec.Issue, error) {
	if callexpr, matched := gosec.MatchCallByPackage(n, c, r.pkg, r.calls...); matched {
		modeArg := callexpr.Args[len(callexpr.Args)-1]
		if mode, err := gosec.GetInt(modeArg); err == nil && mode > r.mode {
			return gosec.NewIssue(c, n, r.ID(), r.What, r.Severity, r.Confidence), nil
		}
	}
	return nil, nil
}

// NewFilePerms creates a rule to detect file creation with a more permissive than configured
// permission mask.
func NewFilePerms(id string, conf gosec.Config) (gosec.Rule, []ast.Node) {
	mode := getConfiguredMode(conf, "G302", 0600)
	return &filePermissions{
		mode:  mode,
		pkg:   "os",
		calls: []string{"OpenFile", "Chmod"},
		MetaData: gosec.MetaData{
			ID:         id,
			Severity:   gosec.Medium,
			Confidence: gosec.High,
			What:       fmt.Sprintf("Expect file permissions to be %#o or less", mode),
		},
	}, []ast.Node{(*ast.CallExpr)(nil)}
}

// NewMkdirPerms creates a rule to detect directory creation with more permissive than
// configured permission mask.
func NewMkdirPerms(id string, conf gosec.Config) (gosec.Rule, []ast.Node) {
	mode := getConfiguredMode(conf, "G301", 0750)
	return &filePermissions{
		mode:  mode,
		pkg:   "os",
		calls: []string{"Mkdir", "MkdirAll"},
		MetaData: gosec.MetaData{
			ID:         id,
			Severity:   gosec.Medium,
			Confidence: gosec.High,
			What:       fmt.Sprintf("Expect directory permissions to be %#o or less", mode),
		},
	}, []ast.Node{(*ast.CallExpr)(nil)}
}
