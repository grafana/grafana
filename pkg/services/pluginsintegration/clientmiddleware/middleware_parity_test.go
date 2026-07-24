package clientmiddleware

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestQueryDataQueryChunkedDataParity guards against a middleware customizing
// QueryData while leaving QueryChunkedData to fall through backend.BaseHandler's
// no-op pass-through (or vice versa). Every client middleware must treat the
// chunked query path the same as the regular query path, so any type in this
// package that declares one of the two methods must declare the other.
//
// It parses this package's own source rather than using reflection because a
// method promoted from an embedded backend.BaseHandler is indistinguishable from
// an explicitly declared one at runtime: both report the outer type's name.
func TestQueryDataQueryChunkedDataParity(t *testing.T) {
	// receiverType -> set of method names declared directly on that type.
	declared := map[string]map[string]bool{}

	entries, err := os.ReadDir(".")
	require.NoError(t, err)

	fset := token.NewFileSet()
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}

		f, err := parser.ParseFile(fset, name, nil, 0)
		require.NoError(t, err)

		for _, decl := range f.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Recv == nil || len(fn.Recv.List) == 0 {
				continue
			}
			recv := receiverTypeName(fn.Recv.List[0].Type)
			if recv == "" {
				continue
			}
			if declared[recv] == nil {
				declared[recv] = map[string]bool{}
			}
			declared[recv][fn.Name.Name] = true
		}
	}

	// Sanity check: parsing found the middleware methods. If this ever drops to
	// zero the parse silently broke and the parity assertions below would be
	// vacuously true.
	var typesWithQueryData int
	for _, methods := range declared {
		if methods["QueryData"] {
			typesWithQueryData++
		}
	}
	require.NotZero(t, typesWithQueryData, "expected to find middleware types declaring QueryData")

	for recv, methods := range declared {
		hasQueryData := methods["QueryData"]
		hasQueryChunkedData := methods["QueryChunkedData"]
		require.Equalf(t, hasQueryData, hasQueryChunkedData,
			"%s declares QueryData=%v but QueryChunkedData=%v; a middleware that customizes one query path must customize the other so chunked queries get the same treatment",
			recv, hasQueryData, hasQueryChunkedData)
	}
}

// receiverTypeName returns the bare type name for a method receiver expression,
// stripping a leading pointer and any generic type parameters.
func receiverTypeName(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.StarExpr:
		return receiverTypeName(t.X)
	case *ast.Ident:
		return t.Name
	case *ast.IndexExpr: // generic receiver, e.g. *Foo[T]
		return receiverTypeName(t.X)
	case *ast.IndexListExpr: // generic receiver with multiple type params
		return receiverTypeName(t.X)
	}
	return ""
}
