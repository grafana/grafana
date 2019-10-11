package lintutil

import (
	"go/ast"

	"golang.org/x/tools/go/ast/astutil"
)

// FindNode applies pred for root and all it's childs until it returns true.
// Matched node is returned.
// If none of the nodes matched predicate, nil is returned.
func FindNode(root ast.Node, pred func(ast.Node) bool) ast.Node {
	var found ast.Node
	astutil.Apply(root, nil, func(cur *astutil.Cursor) bool {
		if pred(cur.Node()) {
			found = cur.Node()
			return false
		}
		return true
	})
	return found
}

// ContainsNode reports whether `FindNode(root, pred)!=nil`.
func ContainsNode(root ast.Node, pred func(ast.Node) bool) bool {
	return FindNode(root, pred) != nil
}
