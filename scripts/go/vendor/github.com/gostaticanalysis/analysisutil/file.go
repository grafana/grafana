package analysisutil

import (
	"go/ast"
	"go/token"

	"golang.org/x/tools/go/analysis"
)

// File finds *ast.File in pass.Files by pos.
func File(pass *analysis.Pass, pos token.Pos) *ast.File {
	for _, f := range pass.Files {
		if f.Pos() <= pos && pos <= f.End() {
			return f
		}
	}
	return nil
}
