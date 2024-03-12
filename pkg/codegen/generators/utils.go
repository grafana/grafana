package generators

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
	"fmt"
	"strconv"
	"strings"
)

// sanitizeLabelString strips characters from a string that are not allowed for
// use in a CUE label.
func sanitizeLabelString(s string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			fallthrough
		case r >= 'A' && r <= 'Z':
			fallthrough
		case r >= '0' && r <= '9':
			fallthrough
		case r == '_':
			return r
		default:
			return -1
		}
	}, s)
}

// trimPathPrefix strips the provided prefix from the provided path, if the
// prefix exists.
//
// If path and prefix are equivalent, and there is at least one additional
// selector in the provided path.
func trimPathPrefix(path, prefix cue.Path) cue.Path {
	sels, psels := path.Selectors(), prefix.Selectors()
	if len(sels) == 1 {
		return path
	}
	var i int
	for ; i < len(psels) && i < len(sels); i++ {
		if !selEq(psels[i], sels[i]) {
			break
		}
	}
	return cue.MakePath(sels[i:]...)
}

// selEq indicates whether two selectors are equivalent. Selectors are equivalent if
// they are either exactly equal, or if they are equal ignoring path optionality.
func selEq(s1, s2 cue.Selector) bool {
	return s1 == s2 || s1.Optional() == s2.Optional()
}

// getFieldByLabel returns the ast.Field with a given label from a struct-ish input.
func getFieldByLabel(n ast.Node, label string) (*ast.Field, error) {
	var d []ast.Decl
	switch x := n.(type) {
	case *ast.File:
		d = x.Decls
	case *ast.StructLit:
		d = x.Elts
	default:
		return nil, fmt.Errorf("not an *ast.File or *ast.StructLit")
	}

	for _, el := range d {
		if isFieldWithLabel(el, label) {
			return el.(*ast.Field), nil
		}
	}

	return nil, fmt.Errorf("no field with label %q", label)
}

func isFieldWithLabel(n ast.Node, label string) bool {
	if x, is := n.(*ast.Field); is {
		if l, is := x.Label.(*ast.BasicLit); is {
			return strEq(l, label)
		}
		if l, is := x.Label.(*ast.Ident); is {
			return identStrEq(l, label)
		}
	}
	return false
}

func strEq(lit *ast.BasicLit, str string) bool {
	if lit.Kind != token.STRING {
		return false
	}
	ls, _ := strconv.Unquote(lit.Value)
	return str == ls || str == lit.Value
}

func identStrEq(id *ast.Ident, str string) bool {
	if str == id.Name {
		return true
	}
	ls, _ := strconv.Unquote(id.Name)
	return str == ls
}

// pathHasPrefix tests whether the [cue.Path] p begins with prefix.
func pathHasPrefix(p, prefix cue.Path) bool {
	ps, pres := p.Selectors(), prefix.Selectors()
	if len(pres) > len(ps) {
		return false
	}
	return pathsAreEq(ps[:len(pres)], pres)
}

func pathsAreEq(p1s, p2s []cue.Selector) bool {
	if len(p1s) != len(p2s) {
		return false
	}
	for i := 0; i < len(p2s); i++ {
		if !selEq(p2s[i], p1s[i]) {
			return false
		}
	}
	return true
}
