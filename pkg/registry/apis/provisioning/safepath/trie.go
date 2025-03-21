package safepath

// trieNode represents a single node in the trie
type trieNode struct {
	children map[string]*trieNode
	isPath   bool // marks if this node represents a complete path
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
func (t *Trie) Add(path string) {
	if path == "" {
		return
	}

	current := t.root
	for _, segment := range Split(path) {
		if segment == "" {
			continue
		}
		if current.children == nil {
			current.children = make(map[string]*trieNode)
		}
		if _, exists := current.children[segment]; !exists {
			current.children[segment] = &trieNode{
				children: make(map[string]*trieNode),
			}
		}
		current = current.children[segment]
	}
	current.isPath = true
}

// Exists checks if a path exists in the trie
func (t *Trie) Exists(path string) bool {
	if path == "" {
		return false
	}

	current := t.root
	for _, segment := range Split(path) {
		if segment == "" {
			continue
		}
		if current.children == nil {
			return false
		}
		next, exists := current.children[segment]
		if !exists {
			return false
		}
		current = next
	}
	return current.isPath
}
