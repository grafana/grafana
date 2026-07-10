package github

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// concreteProviderSpecFields are the concrete provider specs a shared githubRepository method
// must never dereference: for a GitHub repository Spec.GitHubEnterprise is nil, and for a
// GitHub Enterprise repository Spec.GitHub is nil, so touching either panics for one provider.
var concreteProviderSpecFields = map[string]bool{
	"GitHub":           true,
	"GitHubEnterprise": true,
}

// TestGithubRepositoryUsesAgnosticSpecAccessors enforces that no *githubRepository method
// reaches into a concrete provider spec (Spec.GitHub / Spec.GitHubEnterprise).
//
// githubRepository is shared: GitHub repositories embed it directly and GitHub Enterprise
// repositories embed it via the enterprise wrapper. Methods must use the provider-agnostic
// accessors instead: r.config.URL(), r.config.Branch(), r.config.Path().
//
// This is a static guard over every method, so it catches regressions the moment they are
// written rather than at runtime for one provider.
func TestGithubRepositoryUsesAgnosticSpecAccessors(t *testing.T) {
	const receiverType = "githubRepository"

	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatalf("glob package files: %v", err)
	}

	fset := token.NewFileSet()
	methodsChecked := 0

	for _, file := range files {
		if strings.HasSuffix(file, "_test.go") {
			continue
		}

		f, err := parser.ParseFile(fset, file, nil, 0)
		if err != nil {
			t.Fatalf("parse %s: %v", file, err)
		}

		violations, n := scanForbiddenSpecAccess(fset, f, receiverType, concreteProviderSpecFields)
		methodsChecked += n
		for _, v := range violations {
			t.Errorf("%s; githubRepository is shared with GitHub Enterprise (where that spec is nil), "+
				"so use the provider-agnostic *provisioning.Repository accessors (URL()/Branch()/Path()) instead", v)
		}
	}

	// Guard against the scan silently covering nothing (e.g. if methods move to another file).
	if methodsChecked == 0 {
		t.Fatalf("no %s methods found to check; the guard is not scanning anything", receiverType)
	}
}

// TestScanForbiddenSpecAccess verifies the detection logic itself: it must flag a
// "<expr>.Spec.GitHub" read inside a method on the receiver, and must not flag the agnostic
// accessors. Without this, a refactor could silently break the matcher and turn the guard
// above into a no-op that still passes.
func TestScanForbiddenSpecAccess(t *testing.T) {
	const src = `package github

type githubRepository struct{ config *T }

func (r *githubRepository) Bad() string      { return r.config.Spec.GitHub.URL }
func (r *githubRepository) BadEnterprise() string { return r.config.Spec.GitHubEnterprise.URL }
func (r *githubRepository) Good() string     { return r.config.URL() }
func (r *githubRepository) GoodBranch() string { return r.config.Branch() }
func (r *otherType) NotScanned() string      { return r.config.Spec.GitHub.URL }
`

	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, "src.go", src, 0)
	require.NoError(t, err)

	violations, methodsChecked := scanForbiddenSpecAccess(fset, f, "githubRepository", concreteProviderSpecFields)

	assert.Equal(t, 4, methodsChecked, "should scan every githubRepository method regardless of visibility, and skip other receivers")

	joined := strings.Join(violations, "\n")
	assert.Len(t, violations, 2, "should flag exactly the two concrete-spec reads:\n%s", joined)
	assert.Contains(t, joined, "githubRepository.Bad reads Spec.GitHub")
	assert.Contains(t, joined, "githubRepository.BadEnterprise reads Spec.GitHubEnterprise")
	assert.NotContains(t, joined, "Good", "agnostic accessor calls must not be flagged")
	assert.NotContains(t, joined, "NotScanned", "methods on other receivers must not be scanned")
}

// scanForbiddenSpecAccess walks every method on receiverType in f and returns a message for
// each read of a forbidden concrete provider spec (an "<expr>.Spec.<Field>" chain), plus the
// number of methods it scanned.
//
// It matches the "<expr>.Spec.<Field>" chain syntactically. Aliasing the spec to a local
// (s := r.config.Spec; s.GitHub) would evade it, but no method does that and the direct chain
// is the idiomatic form worth guarding.
func scanForbiddenSpecAccess(fset *token.FileSet, f *ast.File, receiverType string, forbidden map[string]bool) (violations []string, methodsChecked int) {
	for _, decl := range f.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || !isMethodOn(fn, receiverType) || fn.Body == nil {
			continue
		}
		methodsChecked++

		ast.Inspect(fn.Body, func(n ast.Node) bool {
			sel, ok := n.(*ast.SelectorExpr)
			if !ok || !forbidden[sel.Sel.Name] {
				return true
			}
			// Match the "<expr>.Spec.<Field>" chain specifically.
			if inner, ok := sel.X.(*ast.SelectorExpr); ok && inner.Sel.Name == "Spec" {
				violations = append(violations, fmt.Sprintf("%s.%s reads Spec.%s at %s",
					receiverType, fn.Name.Name, sel.Sel.Name, fset.Position(sel.Pos())))
			}
			return true
		})
	}
	return violations, methodsChecked
}

// isMethodOn reports whether fn is a method whose receiver is receiverType or *receiverType.
func isMethodOn(fn *ast.FuncDecl, receiverType string) bool {
	if fn.Recv == nil || len(fn.Recv.List) == 0 {
		return false
	}
	expr := fn.Recv.List[0].Type
	if star, ok := expr.(*ast.StarExpr); ok {
		expr = star.X
	}
	ident, ok := expr.(*ast.Ident)
	return ok && ident.Name == receiverType
}
