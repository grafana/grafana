package safepath

// node represents a single node in the trie
type node struct {
	children map[string]*node
	isPath   bool // marks if this node represents a complete path
}

// Tree implements a trie structure for path lookups
type Tree struct {
	root *node
}

func NewTree() *Tree {
	return &Tree{
		root: &node{
			children: make(map[string]*node),
		},
	}
}

// Add inserts a path into the trie
func (t *Tree) Add(path string) {
	if path == "" {
		return
	}

	current := t.root
	for _, segment := range Split(path) {
		if segment == "" {
			continue
		}
		if current.children == nil {
			current.children = make(map[string]*node)
		}
		if _, exists := current.children[segment]; !exists {
			current.children[segment] = &node{
				children: make(map[string]*node),
			}
		}
		current = current.children[segment]
	}
	current.isPath = true
}

// Exists checks if a path exists in the trie
func (t *Tree) Exists(path string) bool {
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
