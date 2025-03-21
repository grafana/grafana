// Package safepath provides utilities for safe path handling and validation
// through a trie-based implementation.
package safepath

import (
	"fmt"
)

// trieNode represents a single node in the trie data structure.
type trieNode struct {
	children map[string]*trieNode
	isDir    bool // marks if this node represents a directory
}

// Trie implements a trie data structure for efficient path lookups and validation.
type Trie struct {
	root *trieNode
}

// NewTrie creates and returns a new initialized Trie.
func NewTrie() *Trie {
	return &Trie{
		root: &trieNode{
			children: make(map[string]*trieNode),
		},
	}
}

// Add inserts a path into the trie. It returns an error if there's a conflict
// between the path types (file vs directory) or if the path is invalid.
func (t *Trie) Add(path string) error {
	if path == "" || path == "/" {
		return nil
	}

	current := t.root
	segments := Split(path)

	var accumulatedPath string
	for i, segment := range segments {
		accumulatedPath = Join(accumulatedPath, segment)
		if current.children == nil {
			current.children = make(map[string]*trieNode)
		}

		isLastSegment := i == len(segments)-1
		node, exists := current.children[segment]
		if !exists {
			node = &trieNode{
				children: make(map[string]*trieNode),
			}
			current.children[segment] = node
		} else {
			if (!isLastSegment && !node.isDir) || (isLastSegment && !node.isDir && IsDir(path)) {
				return fmt.Errorf("path %q exists but is not a directory", accumulatedPath)
			}

			if isLastSegment && node.isDir && !IsDir(path) {
				return fmt.Errorf("path %q exists but is not a file", accumulatedPath)
			}
		}

		current = node
		current.isDir = !isLastSegment || IsDir(path)
	}

	return nil
}

// Exists checks if a path exists in the trie and matches its expected type (file/directory).
func (t *Trie) Exists(path string) bool {
	if path == "" || path == "/" {
		return true
	}

	current := t.root
	segments := Split(path)

	for i, segment := range segments {
		if current.children == nil {
			return false
		}

		next, exists := current.children[segment]
		if !exists {
			return false
		}

		current = next
		isLastSegment := i == len(segments)-1

		if isLastSegment {
			return current.isDir == IsDir(path)
		}
	}

	return false
}
