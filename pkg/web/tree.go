// Copyright 2015 The Macaron Authors
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

package web

import (
	urlpkg "net/url"
	"regexp"
	"strconv"
	"strings"
)

type patternType int8

const (
	_PATTERN_STATIC    patternType = iota // /home
	_PATTERN_REGEXP                       // /:id([0-9]+)
	_PATTERN_PATH_EXT                     // /*.*
	_PATTERN_HOLDER                       // /:user
	_PATTERN_MATCH_ALL                    // /*
)

// Leaf represents a leaf route information.
type Leaf struct {
	parent *Tree

	typ        patternType
	pattern    string
	rawPattern string // Contains wildcard instead of regexp
	wildcards  []string
	reg        *regexp.Regexp
	optional   bool

	handle Handle
}

var wildcardPattern = regexp.MustCompile(`:[a-zA-Z0-9]+`)

func isSpecialRegexp(pattern, regStr string, pos []int) bool {
	return len(pattern) >= pos[1]+len(regStr) && pattern[pos[1]:pos[1]+len(regStr)] == regStr
}

// getNextWildcard tries to find next wildcard and update pattern with corresponding regexp.
func getNextWildcard(pattern string) (wildcard, _ string) {
	pos := wildcardPattern.FindStringIndex(pattern)
	if pos == nil {
		return "", pattern
	}
	wildcard = pattern[pos[0]:pos[1]]

	// Reach last character or no regexp is given.
	if len(pattern) == pos[1] {
		return wildcard, strings.Replace(pattern, wildcard, `(.+)`, 1)
	} else if pattern[pos[1]] != '(' {
		switch {
		case isSpecialRegexp(pattern, ":int", pos):
			pattern = strings.Replace(pattern, ":int", "([0-9]+)", 1)
		case isSpecialRegexp(pattern, ":string", pos):
			pattern = strings.Replace(pattern, ":string", "([\\w]+)", 1)
		default:
			return wildcard, strings.Replace(pattern, wildcard, `(.+)`, 1)
		}
	}

	// Cut out placeholder directly.
	return wildcard, pattern[:pos[0]] + pattern[pos[1]:]
}

func getWildcards(pattern string) (string, []string) {
	wildcards := make([]string, 0, 2)

	// Keep getting next wildcard until nothing is left.
	var wildcard string
	for {
		wildcard, pattern = getNextWildcard(pattern)
		if len(wildcard) > 0 {
			wildcards = append(wildcards, wildcard)
		} else {
			break
		}
	}

	return pattern, wildcards
}

// getRawPattern removes all regexp but keeps wildcards for building URL path.
func getRawPattern(rawPattern string) string {
	rawPattern = strings.ReplaceAll(rawPattern, ":int", "")
	rawPattern = strings.ReplaceAll(rawPattern, ":string", "")

	for {
		startIdx := strings.Index(rawPattern, "(")
		if startIdx == -1 {
			break
		}

		closeIdx := strings.Index(rawPattern, ")")
		if closeIdx > -1 {
			rawPattern = rawPattern[:startIdx] + rawPattern[closeIdx+1:]
		}
	}
	return rawPattern
}

func checkPattern(pattern string) (typ patternType, rawPattern string, wildcards []string, reg *regexp.Regexp) {
	pattern = strings.TrimLeft(pattern, "?")
	rawPattern = getRawPattern(pattern)

	if pattern == "*" {
		typ = _PATTERN_MATCH_ALL
	} else if pattern == "*.*" {
		typ = _PATTERN_PATH_EXT
	} else if strings.Contains(pattern, ":") {
		typ = _PATTERN_REGEXP
		pattern, wildcards = getWildcards(pattern)
		if pattern == "(.+)" {
			typ = _PATTERN_HOLDER
		} else {
			reg = regexp.MustCompile(pattern)
		}
	}
	return typ, rawPattern, wildcards, reg
}

func NewLeaf(parent *Tree, pattern string, handle Handle) *Leaf {
	typ, rawPattern, wildcards, reg := checkPattern(pattern)
	optional := false
	if len(pattern) > 0 && pattern[0] == '?' {
		optional = true
	}
	return &Leaf{parent, typ, pattern, rawPattern, wildcards, reg, optional, handle}
}

// URLPath build path part of URL by given pair values.
func (l *Leaf) URLPath(pairs ...string) string {
	if len(pairs)%2 != 0 {
		panic("number of pairs does not match")
	}

	urlPath := l.rawPattern
	parent := l.parent
	for parent != nil {
		urlPath = parent.rawPattern + "/" + urlPath
		parent = parent.parent
	}
	for i := 0; i < len(pairs); i += 2 {
		if len(pairs[i]) == 0 {
			panic("pair value cannot be empty: " + strconv.Itoa(i))
		} else if pairs[i][0] != ':' && pairs[i] != "*" && pairs[i] != "*.*" {
			pairs[i] = ":" + pairs[i]
		}
		urlPath = strings.Replace(urlPath, pairs[i], pairs[i+1], 1)
	}
	return urlPath
}

// Tree represents a router tree in Macaron.
type Tree struct {
	parent *Tree

	typ        patternType
	pattern    string
	rawPattern string
	wildcards  []string
	reg        *regexp.Regexp

	subtrees []*Tree
	leaves   []*Leaf
}

func NewSubtree(parent *Tree, pattern string) *Tree {
	typ, rawPattern, wildcards, reg := checkPattern(pattern)
	return &Tree{parent, typ, pattern, rawPattern, wildcards, reg, make([]*Tree, 0, 5), make([]*Leaf, 0, 5)}
}

func NewTree() *Tree {
	return NewSubtree(nil, "")
}

func (t *Tree) addLeaf(pattern string, handle Handle) *Leaf {
	for i := 0; i < len(t.leaves); i++ {
		if t.leaves[i].pattern == pattern {
			return t.leaves[i]
		}
	}

	leaf := NewLeaf(t, pattern, handle)

	// Add exact same leaf to grandparent/parent level without optional.
	if leaf.optional {
		parent := leaf.parent
		if parent.parent != nil {
			parent.parent.addLeaf(parent.pattern, handle)
		} else {
			parent.addLeaf("", handle) // Root tree can add as empty pattern.
		}
	}

	i := 0
	for ; i < len(t.leaves); i++ {
		if leaf.typ < t.leaves[i].typ {
			break
		}
	}

	if i == len(t.leaves) {
		t.leaves = append(t.leaves, leaf)
	} else {
		t.leaves = append(t.leaves[:i], append([]*Leaf{leaf}, t.leaves[i:]...)...)
	}
	return leaf
}

func (t *Tree) addSubtree(segment, pattern string, handle Handle) *Leaf {
	for i := 0; i < len(t.subtrees); i++ {
		if t.subtrees[i].pattern == segment {
			return t.subtrees[i].addNextSegment(pattern, handle)
		}
	}

	subtree := NewSubtree(t, segment)
	i := 0
	for ; i < len(t.subtrees); i++ {
		if subtree.typ < t.subtrees[i].typ {
			break
		}
	}

	if i == len(t.subtrees) {
		t.subtrees = append(t.subtrees, subtree)
	} else {
		t.subtrees = append(t.subtrees[:i], append([]*Tree{subtree}, t.subtrees[i:]...)...)
	}
	return subtree.addNextSegment(pattern, handle)
}

func (t *Tree) addNextSegment(pattern string, handle Handle) *Leaf {
	pattern = strings.TrimPrefix(pattern, "/")

	i := strings.Index(pattern, "/")
	if i == -1 {
		return t.addLeaf(pattern, handle)
	}
	return t.addSubtree(pattern[:i], pattern[i+1:], handle)
}

func (t *Tree) Add(pattern string, handle Handle) *Leaf {
	pattern = strings.TrimSuffix(pattern, "/")
	return t.addNextSegment(pattern, handle)
}

func (t *Tree) matchLeaf(globLevel int, url string, params map[string]string) (Handle, bool) {
	url, err := urlpkg.PathUnescape(url)
	if err != nil {
		return nil, false
	}
	for i := 0; i < len(t.leaves); i++ {
		switch t.leaves[i].typ {
		case _PATTERN_STATIC:
			if t.leaves[i].pattern == url {
				return t.leaves[i].handle, true
			}
		case _PATTERN_REGEXP:
			results := t.leaves[i].reg.FindStringSubmatch(url)
			// Number of results and wildcasrd should be exact same.
			if len(results)-1 != len(t.leaves[i].wildcards) {
				break
			}

			for j := 0; j < len(t.leaves[i].wildcards); j++ {
				params[t.leaves[i].wildcards[j]] = results[j+1]
			}
			return t.leaves[i].handle, true
		case _PATTERN_PATH_EXT:
			j := strings.LastIndex(url, ".")
			if j > -1 {
				params[":path"] = url[:j]
				params[":ext"] = url[j+1:]
			} else {
				params[":path"] = url
			}
			return t.leaves[i].handle, true
		case _PATTERN_HOLDER:
			params[t.leaves[i].wildcards[0]] = url
			return t.leaves[i].handle, true
		case _PATTERN_MATCH_ALL:
			params["*"] = url
			params["*"+strconv.Itoa(globLevel)] = url
			return t.leaves[i].handle, true
		}
	}
	return nil, false
}

func (t *Tree) matchSubtree(globLevel int, segment, url string, params map[string]string) (Handle, bool) {
	unescapedSegment, err := urlpkg.PathUnescape(segment)
	if err != nil {
		return nil, false
	}
	for i := 0; i < len(t.subtrees); i++ {
		switch t.subtrees[i].typ {
		case _PATTERN_STATIC:
			if t.subtrees[i].pattern == unescapedSegment {
				if handle, ok := t.subtrees[i].matchNextSegment(globLevel, url, params); ok {
					return handle, true
				}
			}
		case _PATTERN_REGEXP:
			results := t.subtrees[i].reg.FindStringSubmatch(unescapedSegment)
			if len(results)-1 != len(t.subtrees[i].wildcards) {
				break
			}

			for j := 0; j < len(t.subtrees[i].wildcards); j++ {
				params[t.subtrees[i].wildcards[j]] = results[j+1]
			}
			if handle, ok := t.subtrees[i].matchNextSegment(globLevel, url, params); ok {
				return handle, true
			}
		case _PATTERN_HOLDER:
			if handle, ok := t.subtrees[i].matchNextSegment(globLevel+1, url, params); ok {
				params[t.subtrees[i].wildcards[0]] = unescapedSegment
				return handle, true
			}
		case _PATTERN_MATCH_ALL:
			if handle, ok := t.subtrees[i].matchNextSegment(globLevel+1, url, params); ok {
				params["*"+strconv.Itoa(globLevel)] = unescapedSegment
				return handle, true
			}
		default: // ignore
		}
	}

	if len(t.leaves) > 0 {
		leaf := t.leaves[len(t.leaves)-1]
		unescapedURL, err := urlpkg.PathUnescape(segment + "/" + url)
		if err != nil {
			return nil, false
		}
		if leaf.typ == _PATTERN_PATH_EXT {
			j := strings.LastIndex(unescapedURL, ".")
			if j > -1 {
				params[":path"] = unescapedURL[:j]
				params[":ext"] = unescapedURL[j+1:]
			} else {
				params[":path"] = unescapedURL
			}
			return leaf.handle, true
		} else if leaf.typ == _PATTERN_MATCH_ALL {
			params["*"] = unescapedURL
			params["*"+strconv.Itoa(globLevel)] = unescapedURL
			return leaf.handle, true
		}
	}
	return nil, false
}

func (t *Tree) matchNextSegment(globLevel int, url string, params map[string]string) (Handle, bool) {
	i := strings.Index(url, "/")
	if i == -1 {
		return t.matchLeaf(globLevel, url, params)
	}
	return t.matchSubtree(globLevel, url[:i], url[i+1:], params)
}

func (t *Tree) Match(url string) (Handle, map[string]string, bool) {
	url = strings.TrimPrefix(url, "/")
	url = strings.TrimSuffix(url, "/")
	params := map[string]string{}
	handle, ok := t.matchNextSegment(0, url, params)
	return handle, params, ok
}

// MatchTest returns true if given URL is matched by given pattern.
func MatchTest(pattern, url string) bool {
	t := NewTree()
	t.Add(pattern, nil)
	_, _, ok := t.Match(url)
	return ok
}
