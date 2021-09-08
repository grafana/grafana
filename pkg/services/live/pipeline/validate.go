package pipeline

import (
	"fmt"
	"regexp"

	"github.com/robertkrimen/otto/ast"
	"github.com/robertkrimen/otto/parser"
)

type jsWalker struct {
	err error
}

func (w *jsWalker) Enter(n ast.Node) ast.Visitor {
	if w.err != nil {
		return w
	}
	switch n.(type) {
	case *ast.FunctionLiteral:
		w.err = fmt.Errorf("function detected")
	case *ast.WhileStatement:
		w.err = fmt.Errorf("while detected")
	case *ast.WithStatement:
		w.err = fmt.Errorf("with detected")
	case *ast.ReturnStatement:
		w.err = fmt.Errorf("return detected")
	case *ast.ForStatement:
		w.err = fmt.Errorf("for detected")
	case *ast.ForInStatement:
		w.err = fmt.Errorf("for in detected")
	case *ast.DoWhileStatement:
		w.err = fmt.Errorf("do while detected")
	case *ast.DebuggerStatement:
		w.err = fmt.Errorf("debugger stetement detected")
	default:
	}
	return w
}

func (w *jsWalker) Exit(n ast.Node) {
	// AST node n has had all its children walked. Pop it out of your
	// stack, or do whatever processing you need to do, if any.
}

var patternPattern = regexp.MustCompile(`^[A-z0-9_\-/=.:*]*$`)

var maxPatternLength = 160

func PatternValid(pattern string) bool {
	if len(pattern) > maxPatternLength {
		return false
	}
	return patternPattern.MatchString(pattern)
}

var parameterRe = regexp.MustCompile(`/:[A-z0-9]*`)
var catchallRe = regexp.MustCompile(`/\*[A-z0-9]*`)

// PatternHash given a pattern creates a string for it which uniquely identifies it
// so that we could protect conflicting patterns from being saved to the database.
func PatternHash(pattern string) string {
	s := parameterRe.ReplaceAllString(pattern, `/:parameter`)
	return catchallRe.ReplaceAllString(s, `/*catchall`)
}

func CheckJavascriptValid(source string) error {
	program, err := parser.ParseFile(nil, "", source, 0)
	if err != nil {
		return err
	}
	w := &jsWalker{}
	ast.Walk(w, program)
	return w.err
}
