// Copyright 2013 Beego Authors
// Copyright 2014 Unknwon
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package macaron

// NOTE: last sync 0c93364 on Dec 19, 2014.

import (
	"path"
	"regexp"
	"strings"

	"github.com/Unknwon/com"
)

type leafInfo struct {
	// Names of wildcards that lead to this leaf.
	// eg, ["id" "name"] for the wildcard ":id" and ":name".
	wildcards []string
	// Not nil if the leaf is regexp.
	regexps *regexp.Regexp
	handle  Handle
}

func (leaf *leafInfo) match(wildcardValues []string) (ok bool, params Params) {
	if leaf.regexps == nil {
		if len(wildcardValues) == 0 && len(leaf.wildcards) > 0 {
			if com.IsSliceContainsStr(leaf.wildcards, ":") {
				params = make(map[string]string)
				j := 0
				for _, v := range leaf.wildcards {
					if v == ":" {
						continue
					}
					params[v] = ""
					j += 1
				}
				return true, params
			}
			return false, nil
		} else if len(wildcardValues) == 0 {
			return true, nil // Static path.
		}

		// Match *
		if len(leaf.wildcards) == 1 && leaf.wildcards[0] == ":splat" {
			params = make(map[string]string)
			params[":splat"] = path.Join(wildcardValues...)
			return true, params
		}

		// Match *.*
		if len(leaf.wildcards) == 3 && leaf.wildcards[0] == "." {
			params = make(map[string]string)
			lastone := wildcardValues[len(wildcardValues)-1]
			strs := strings.SplitN(lastone, ".", 2)
			if len(strs) == 2 {
				params[":ext"] = strs[1]
			} else {
				params[":ext"] = ""
			}
			params[":path"] = path.Join(wildcardValues[:len(wildcardValues)-1]...) + "/" + strs[0]
			return true, params
		}

		// Match :id
		params = make(map[string]string)
		j := 0
		for _, v := range leaf.wildcards {
			if v == ":" {
				continue
			}
			if v == "." {
				lastone := wildcardValues[len(wildcardValues)-1]
				strs := strings.SplitN(lastone, ".", 2)
				if len(strs) == 2 {
					params[":ext"] = strs[1]
				} else {
					params[":ext"] = ""
				}
				if len(wildcardValues[j:]) == 1 {
					params[":path"] = strs[0]
				} else {
					params[":path"] = path.Join(wildcardValues[j:]...) + "/" + strs[0]
				}
				return true, params
			}
			if len(wildcardValues) <= j {
				return false, nil
			}
			params[v] = wildcardValues[j]
			j++
		}
		if len(params) != len(wildcardValues) {
			return false, nil
		}
		return true, params
	}

	if !leaf.regexps.MatchString(path.Join(wildcardValues...)) {
		return false, nil
	}
	params = make(map[string]string)
	matches := leaf.regexps.FindStringSubmatch(path.Join(wildcardValues...))
	for i, match := range matches[1:] {
		params[leaf.wildcards[i]] = match
	}
	return true, params
}

// Tree represents a router tree for Macaron instance.
type Tree struct {
	fixroutes map[string]*Tree
	wildcard  *Tree
	leaves    []*leafInfo
}

// NewTree initializes and returns a router tree.
func NewTree() *Tree {
	return &Tree{
		fixroutes: make(map[string]*Tree),
	}
}

// splitPath splites patthen into parts.
//
// Examples:
//		"/" -> []
// 		"/admin" -> ["admin"]
// 		"/admin/" -> ["admin"]
// 		"/admin/users" -> ["admin", "users"]
func splitPath(pattern string) []string {
	if len(pattern) == 0 {
		return []string{}
	}

	elements := strings.Split(pattern, "/")
	if elements[0] == "" {
		elements = elements[1:]
	}
	if elements[len(elements)-1] == "" {
		elements = elements[:len(elements)-1]
	}
	return elements
}

// AddRouter adds a new route to router tree.
func (t *Tree) AddRouter(pattern string, handle Handle) {
	t.addSegments(splitPath(pattern), handle, nil, "")
}

// splitSegment splits segment into parts.
//
// Examples:
// 		"admin" -> false, nil, ""
// 		":id" -> true, [:id], ""
// 		"?:id" -> true, [: :id], ""        : meaning can empty
// 		":id:int" -> true, [:id], ([0-9]+)
// 		":name:string" -> true, [:name], ([\w]+)
// 		":id([0-9]+)" -> true, [:id], ([0-9]+)
// 		":id([0-9]+)_:name" -> true, [:id :name], ([0-9]+)_(.+)
// 		"cms_:id_:page.html" -> true, [:id :page], cms_(.+)_(.+).html
// 		"*" -> true, [:splat], ""
// 		"*.*" -> true,[. :path :ext], ""      . meaning separator
func splitSegment(key string) (bool, []string, string) {
	if strings.HasPrefix(key, "*") {
		if key == "*.*" {
			return true, []string{".", ":path", ":ext"}, ""
		} else {
			return true, []string{":splat"}, ""
		}
	}
	if strings.ContainsAny(key, ":") {
		var paramsNum int
		var out []rune
		var start bool
		var startexp bool
		var param []rune
		var expt []rune
		var skipnum int
		params := []string{}
		reg := regexp.MustCompile(`[a-zA-Z0-9]+`)
		for i, v := range key {
			if skipnum > 0 {
				skipnum -= 1
				continue
			}
			if start {
				//:id:int and :name:string
				if v == ':' {
					if len(key) >= i+4 {
						if key[i+1:i+4] == "int" {
							out = append(out, []rune("([0-9]+)")...)
							params = append(params, ":"+string(param))
							start = false
							startexp = false
							skipnum = 3
							param = make([]rune, 0)
							paramsNum += 1
							continue
						}
					}
					if len(key) >= i+7 {
						if key[i+1:i+7] == "string" {
							out = append(out, []rune(`([\w]+)`)...)
							params = append(params, ":"+string(param))
							paramsNum += 1
							start = false
							startexp = false
							skipnum = 6
							param = make([]rune, 0)
							continue
						}
					}
				}
				// params only support a-zA-Z0-9
				if reg.MatchString(string(v)) {
					param = append(param, v)
					continue
				}
				if v != '(' {
					out = append(out, []rune(`(.+)`)...)
					params = append(params, ":"+string(param))
					param = make([]rune, 0)
					paramsNum += 1
					start = false
					startexp = false
				}
			}
			if startexp {
				if v != ')' {
					expt = append(expt, v)
					continue
				}
			}
			if v == ':' {
				param = make([]rune, 0)
				start = true
			} else if v == '(' {
				startexp = true
				start = false
				params = append(params, ":"+string(param))
				paramsNum += 1
				expt = make([]rune, 0)
				expt = append(expt, '(')
			} else if v == ')' {
				startexp = false
				expt = append(expt, ')')
				out = append(out, expt...)
				param = make([]rune, 0)
			} else if v == '?' {
				params = append(params, ":")
			} else {
				out = append(out, v)
			}
		}
		if len(param) > 0 {
			if paramsNum > 0 {
				out = append(out, []rune(`(.+)`)...)
			}
			params = append(params, ":"+string(param))
		}
		return true, params, string(out)
	} else {
		return false, nil, ""
	}
}

// addSegments add segments to the router tree.
func (t *Tree) addSegments(segments []string, handle Handle, wildcards []string, reg string) {
	// Fixed root route.
	if len(segments) == 0 {
		if reg != "" {
			filterCards := make([]string, 0, len(wildcards))
			for _, v := range wildcards {
				if v == ":" || v == "." {
					continue
				}
				filterCards = append(filterCards, v)
			}
			t.leaves = append(t.leaves, &leafInfo{
				handle:    handle,
				wildcards: filterCards,
				regexps:   regexp.MustCompile("^" + reg + "$"),
			})
		} else {
			t.leaves = append(t.leaves, &leafInfo{
				handle:    handle,
				wildcards: wildcards,
			})
		}
		return
	}

	seg := segments[0]
	iswild, params, regexpStr := splitSegment(seg)
	//for the router  /login/*/access match /login/2009/11/access
	if !iswild && com.IsSliceContainsStr(wildcards, ":splat") {
		iswild = true
		regexpStr = seg
	}
	if seg == "*" && len(wildcards) > 0 && reg == "" {
		iswild = true
		regexpStr = "(.+)"
	}
	if iswild {
		if t.wildcard == nil {
			t.wildcard = NewTree()
		}
		if regexpStr != "" {
			if reg == "" {
				rr := ""
				for _, w := range wildcards {
					if w == "." || w == ":" {
						continue
					}
					if w == ":splat" {
						rr = rr + "(.+)/"
					} else {
						rr = rr + "([^/]+)/"
					}
				}
				regexpStr = rr + regexpStr
			} else {
				regexpStr = "/" + regexpStr
			}
		} else if reg != "" {
			if seg == "*.*" {
				regexpStr = "/([^.]+).(.+)"
			} else {
				for _, w := range params {
					if w == "." || w == ":" {
						continue
					}
					regexpStr = "/([^/]+)" + regexpStr
				}
			}
		}
		t.wildcard.addSegments(segments[1:], handle, append(wildcards, params...), reg+regexpStr)
	} else {
		subTree, ok := t.fixroutes[seg]
		if !ok {
			subTree = NewTree()
			t.fixroutes[seg] = subTree
		}
		subTree.addSegments(segments[1:], handle, wildcards, reg)
	}
}

func (t *Tree) match(segments []string, wildcardValues []string) (handle Handle, params Params) {
	// Handle leaf nodes.
	if len(segments) == 0 {
		for _, l := range t.leaves {
			if ok, pa := l.match(wildcardValues); ok {
				return l.handle, pa
			}
		}
		if t.wildcard != nil {
			for _, l := range t.wildcard.leaves {
				if ok, pa := l.match(wildcardValues); ok {
					return l.handle, pa
				}
			}

		}
		return nil, nil
	}

	seg, segs := segments[0], segments[1:]

	subTree, ok := t.fixroutes[seg]
	if ok {
		handle, params = subTree.match(segs, wildcardValues)
	} else if len(segs) == 0 { //.json .xml
		if subindex := strings.LastIndex(seg, "."); subindex != -1 {
			subTree, ok = t.fixroutes[seg[:subindex]]
			if ok {
				handle, params = subTree.match(segs, wildcardValues)
				if handle != nil {
					if params == nil {
						params = make(map[string]string)
					}
					params[":ext"] = seg[subindex+1:]
					return handle, params
				}
			}
		}
	}
	if handle == nil && t.wildcard != nil {
		handle, params = t.wildcard.match(segs, append(wildcardValues, seg))
	}
	if handle == nil {
		for _, l := range t.leaves {
			if ok, pa := l.match(append(wildcardValues, segments...)); ok {
				return l.handle, pa
			}
		}
	}
	return handle, params
}

// Match returns Handle and params if any route is matched.
func (t *Tree) Match(pattern string) (Handle, Params) {
	if len(pattern) == 0 || pattern[0] != '/' {
		return nil, nil
	}

	return t.match(splitPath(pattern), nil)
}
