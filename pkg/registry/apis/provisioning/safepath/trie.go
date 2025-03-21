package safepath

import "errors"

// trieNode represents a single node in the trie
type trieNode struct {
	children map[string]*trieNode
	isDir    bool // marks if this node represents a directory
}

// Trie implements a trie structure for path lookups
type Trie struct {
	root *trieNode
}

func NewTrie() *Trie {
	return &Trie{
		root: &trieNode{
			children: make(map[string]*trieNode),
		},
	}
}

// Add inserts a path into the trie
func (t *Trie) Add(path string) error {
	if path == "" {
		return nil
	}

	current := t.root
	segments := Split(path)
	for i, segment := range segments {
		if current.children == nil {
			current.children = make(map[string]*trieNode)
		}

		if existing, exists := current.children[segment]; !exists {
			current.children[segment] = &trieNode{
				children: make(map[string]*trieNode),
			}
		} else {
			if i < len(segments)-1 && !existing.isDir {
				return errors.New("segment is not a directory")
			}
		}

		current = current.children[segment]

		if i == len(segments)-1 {
			current.isDir = IsDir(path)
		} else {
			current.isDir = true
		}
	}

	return nil
}

// Exists checks if a path exists in the trie
func (t *Trie) Exists(path string) bool {
	if path == "" {
		return false
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

		// For the last segment, check if it matches the expected type (file/directory)
		if i == len(segments)-1 {
			return current.isDir == IsDir(path)
		}
	}

	return false
}
