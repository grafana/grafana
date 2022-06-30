package authz

import (
	"fmt"
	"strings"
)

type AccessVerb int32

const (
	// Each permission implies the previous
	AccessUnknown AccessVerb = 0
	AccessNone    AccessVerb = 1 // same as block
	AccessRead    AccessVerb = 100
	AccessWrite   AccessVerb = 200
	AccessManage  AccessVerb = 300
	AccessAdmin   AccessVerb = 1000
)

type AccessRule struct {
	Path string     `json:"path"`
	Verb AccessVerb `json:"verb"`
	Kind string     `json:"kind"` // * or single kind
	Who  string     `json:"who"`  // group or userid
}

type accessNode struct {
	Verb         AccessVerb             `json:"verb"`
	Kind         map[string]AccessVerb  `json:"kind"`
	Children     map[string]*accessNode `json:"sub"`
	defaultAcces bool                   // only allow folder checks
}

// Check if this node has acccess
func (n accessNode) HasAccess(path string, kind string, verb AccessVerb) bool {
	v, ok := n.Kind[kind]
	if !ok {
		v = n.Verb
	}
	if verb > v && v > 0 { // root has zero/unknown verb
		return false
	}

	part := path
	idx := strings.Index(path, "/")
	if idx > 0 {
		part = path[:idx]
	}
	sub, ok := n.Children[part]
	if ok {
		return sub.HasAccess(path[idx+1:], kind, verb)
	}
	return n.defaultAcces
}

// Check if this node has acccess
func (n accessNode) add(rule AccessRule) (*accessNode, error) {
	if strings.HasPrefix(rule.Path, "/") {
		return nil, fmt.Errorf("path can not stat with slash")
	}

	idx := strings.Index(rule.Path, "/")
	part := rule.Path
	if idx > 0 {
		part = rule.Path[:idx]
	}

	c, ok := n.Children[part]
	if !ok {
		c = &accessNode{
			Verb:         rule.Verb,
			defaultAcces: n.defaultAcces,
			Kind:         make(map[string]AccessVerb),
			Children:     make(map[string]*accessNode),
		}
		n.Children[part] = c
	}
	if idx > 0 {
		rule.Path = rule.Path[idx+1:]
		return c.add(rule)
	}
	c.defaultAcces = true
	if rule.Kind == "*" || rule.Kind == "" {
		c.Verb = rule.Verb
	} else {
		c.Kind[rule.Kind] = rule.Verb
	}
	return c, nil
}

// HasAccess takes the full path
func buildAccessTrie(rules []AccessRule) (*accessNode, error) {
	root := &accessNode{
		Verb:         0, // unknown
		defaultAcces: false,
		Kind:         make(map[string]AccessVerb),
		Children:     make(map[string]*accessNode),
	}

	// must be in order
	for _, r := range rules {
		if !strings.HasPrefix(r.Path, "/") {
			return nil, fmt.Errorf("rules must have slash prefix: %s", r.Path)
		}
		r.Path = r.Path[1:]
		_, err := root.add(r)
		if err != nil {
			return nil, err
		}
	}
	return root, nil
}
