package lintutil

import (
	"go/ast"
	"go/types"
)

// TODO: this package is a way to reuse code between lint and astwalk.
// Would be good to find it a better name.

// IsTypeExpr reports whether x represents type expression.
//
// Type expression does not evaluate to any run time value,
// but rather describes type that is used inside Go expression.
// For example, (*T)(v) is a CallExpr that "calls" (*T).
// (*T) is a type expression that tells Go compiler type v should be converted to.
func IsTypeExpr(info *types.Info, x ast.Expr) bool {
	switch x := x.(type) {
	case *ast.StarExpr:
		return IsTypeExpr(info, x.X)
	case *ast.ParenExpr:
		return IsTypeExpr(info, x.X)
	case *ast.SelectorExpr:
		return IsTypeExpr(info, x.Sel)
	case *ast.Ident:
		// Identifier may be a type expression if object
		// it reffers to is a type name.
		_, ok := info.ObjectOf(x).(*types.TypeName)
		return ok

	case *ast.FuncType, *ast.StructType, *ast.InterfaceType, *ast.ArrayType, *ast.MapType:
		return true

	default:
		return false
	}
}
