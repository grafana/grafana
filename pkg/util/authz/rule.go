package authz

import (
	"fmt"
	"strings"
)

type accessNode struct {
	Verb     AccessVerb             `json:"verb,omitempty"`
	Kind     map[string]AccessVerb  `json:"kind,omitempty"`
	Children map[string]*accessNode `json:"children,omitempty"`
	root     bool                   `json:"-"`
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

	// need to pass though folders
	if v == 0 {
		return kind == "folder" && !n.root
	}
	return verb <= v
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
			Verb:     AccessUnknown,
			Kind:     make(map[string]AccessVerb),
			Children: make(map[string]*accessNode),
		}
		for k, v := range n.Kind {
			c.Kind[k] = v
		}
		n.Children[part] = c
	}
	if idx > 0 {
		rule.Path = rule.Path[idx+1:]
		return c.add(rule)
	}
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
		Verb:     AccessUnknown,
		Kind:     make(map[string]AccessVerb),
		Children: make(map[string]*accessNode),
		root:     true,
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
