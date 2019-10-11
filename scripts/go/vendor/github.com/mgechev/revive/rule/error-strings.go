package rule

import (
	"go/ast"
	"go/token"
	"strconv"
	"unicode"
	"unicode/utf8"

	"github.com/mgechev/revive/lint"
)

// ErrorStringsRule lints given else constructs.
type ErrorStringsRule struct{}

// Apply applies the rule to given file.
func (r *ErrorStringsRule) Apply(file *lint.File, _ lint.Arguments) []lint.Failure {
	var failures []lint.Failure

	fileAst := file.AST
	walker := lintErrorStrings{
		file:    file,
		fileAst: fileAst,
		onFailure: func(failure lint.Failure) {
			failures = append(failures, failure)
		},
	}

	ast.Walk(walker, fileAst)

	return failures
}

// Name returns the rule name.
func (r *ErrorStringsRule) Name() string {
	return "error-strings"
}

type lintErrorStrings struct {
	file      *lint.File
	fileAst   *ast.File
	onFailure func(lint.Failure)
}

func (w lintErrorStrings) Visit(n ast.Node) ast.Visitor {
	ce, ok := n.(*ast.CallExpr)
	if !ok {
		return w
	}
	if !isPkgDot(ce.Fun, "errors", "New") && !isPkgDot(ce.Fun, "fmt", "Errorf") {
		return w
	}
	if len(ce.Args) < 1 {
		return w
	}
	str, ok := ce.Args[0].(*ast.BasicLit)
	if !ok || str.Kind != token.STRING {
		return w
	}
	s, _ := strconv.Unquote(str.Value) // can assume well-formed Go
	if s == "" {
		return w
	}
	clean, conf := lintErrorString(s)
	if clean {
		return w
	}

	w.onFailure(lint.Failure{
		Node:       str,
		Confidence: conf,
		Category:   "errors",
		Failure:    "error strings should not be capitalized or end with punctuation or a newline",
	})
	return w
}

func lintErrorString(s string) (isClean bool, conf float64) {
	const basicConfidence = 0.8
	const capConfidence = basicConfidence - 0.2
	first, firstN := utf8.DecodeRuneInString(s)
	last, _ := utf8.DecodeLastRuneInString(s)
	if last == '.' || last == ':' || last == '!' || last == '\n' {
		return false, basicConfidence
	}
	if unicode.IsUpper(first) {
		// People use proper nouns and exported Go identifiers in error strings,
		// so decrease the confidence of warnings for capitalization.
		if len(s) <= firstN {
			return false, capConfidence
		}
		// Flag strings starting with something that doesn't look like an initialism.
		if second, _ := utf8.DecodeRuneInString(s[firstN:]); !unicode.IsUpper(second) {
			return false, capConfidence
		}
	}
	return true, 0
}
