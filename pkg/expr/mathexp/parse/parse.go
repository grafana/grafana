// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package parse builds parse trees for expressions as defined by expr. Clients
// should use that package to construct expressions rather than this one, which
// provides shared internal data structures not intended for general use.
package parse

import (
	"fmt"
	"runtime"
	"strconv"
	"strings"
)

// Tree is the representation of a single parsed expression.
type Tree struct {
	Text     string // text parsed to create the expression.
	Root     Node   // top-level root of the tree, returns a number.
	VarNames []string

	funcs []map[string]Func

	// Parsing only; cleared after parse.
	lex       *lexer
	token     [1]item // one-token lookahead for parser.
	peekCount int
}

// Func holds the structure of a parsed function call.
type Func struct {
	Args          []ReturnType
	Return        ReturnType
	F             interface{}
	VariantReturn bool
	Check         func(*Tree, *FuncNode) error
}

// Parse returns a Tree, created by parsing the expression described in the
// argument string. If an error is encountered, parsing stops and an empty Tree
// is returned with the error.
func Parse(text string, funcs ...map[string]Func) (t *Tree, err error) {
	t = New()
	t.Text = text
	err = t.Parse(text, funcs...)
	return
}

// next returns the next token.
func (t *Tree) next() item {
	if t.peekCount > 0 {
		t.peekCount--
	} else {
		t.token[0] = t.lex.nextItem()
	}
	return t.token[t.peekCount]
}

// backup backs the input stream up one token.
func (t *Tree) backup() {
	t.peekCount++
}

// peek returns but does not consume the next token.
func (t *Tree) peek() item {
	if t.peekCount > 0 {
		return t.token[t.peekCount-1]
	}
	t.peekCount = 1
	t.token[0] = t.lex.nextItem()
	return t.token[0]
}

// Parsing.

// New allocates a new parse tree with the given name.
func New(funcs ...map[string]Func) *Tree {
	return &Tree{
		funcs: funcs,
	}
}

// errorf formats the error and terminates processing.
func (t *Tree) errorf(format string, args ...interface{}) {
	t.Root = nil
	format = fmt.Sprintf("expr: %s", format)
	panic(fmt.Errorf(format, args...))
}

// error terminates processing.
func (t *Tree) error(err error) {
	t.errorf("%s", err)
}

// expect consumes the next token and guarantees it has the required type.
func (t *Tree) expect(expected itemType, context string) item {
	token := t.next()
	if token.typ != expected {
		t.unexpected(token, context)
	}
	return token
}

// expectOneOf consumes the next token and guarantees it has one of the required types.
// nolint:unused
func (t *Tree) expectOneOf(expected1, expected2 itemType, context string) item {
	token := t.next()
	if token.typ != expected1 && token.typ != expected2 {
		t.unexpected(token, context)
	}
	return token
}

// unexpected complains about the token and terminates processing.
func (t *Tree) unexpected(token item, context string) {
	t.errorf("unexpected %s in %s", token, context)
}

// recover is the handler that turns panics into returns from the top level of Parse.
func (t *Tree) recover(errp *error) {
	e := recover()
	if e != nil {
		if _, ok := e.(runtime.Error); ok {
			panic(e)
		}
		if t != nil {
			t.stopParse()
		}
		*errp = e.(error)
	}
}

// startParse initializes the parser, using the lexer.
func (t *Tree) startParse(funcs []map[string]Func, lex *lexer) {
	t.Root = nil
	t.lex = lex
	t.funcs = funcs
}

// stopParse terminates parsing.
func (t *Tree) stopParse() {
	t.lex = nil
}

// Parse parses the expression definition string to construct a representation
// of the expression for execution.
func (t *Tree) Parse(text string, funcs ...map[string]Func) (err error) {
	defer t.recover(&err)
	t.startParse(funcs, lex(text))
	t.Text = text
	t.parse()
	t.stopParse()
	return nil
}

// parse is the top-level parser for an expression.
// It runs to EOF.
func (t *Tree) parse() {
	t.Root = t.O()
	t.expect(itemEOF, "root input")
	if err := t.Root.Check(t); err != nil {
		t.error(err)
	}
}

/* Grammar:
O -> A {"||" A}
A -> C {"&&" C}
C -> P {( "==" | "!=" | ">" | ">=" | "<" | "<=") P}
P -> M {( "+" | "-" ) M}
M -> E {( "*" | "/" ) F}
E -> F {( "**" ) F}
F -> v | "(" O ")" | "!" O | "-" O
v -> number | func(..) | queryVar
Func -> name "(" param {"," param} ")"
param -> number | "string" | queryVar
*/

// expr:

// O is A {"||" A} in the grammar.
func (t *Tree) O() Node {
	n := t.A()
	for {
		switch t.peek().typ {
		case itemOr:
			n = newBinary(t.next(), n, t.A())
		default:
			return n
		}
	}
}

// A is C {"&&" C} in the grammar.
func (t *Tree) A() Node {
	n := t.C()
	for {
		switch t.peek().typ {
		case itemAnd:
			n = newBinary(t.next(), n, t.C())
		default:
			return n
		}
	}
}

// C is C -> P {( "==" | "!=" | ">" | ">=" | "<" | "<=") P} in the grammar.
func (t *Tree) C() Node {
	n := t.P()
	for {
		switch t.peek().typ {
		case itemEq, itemNotEq, itemGreater, itemGreaterEq, itemLess, itemLessEq:
			n = newBinary(t.next(), n, t.P())
		default:
			return n
		}
	}
}

// P is  M {( "+" | "-" ) M} in the grammar.
func (t *Tree) P() Node {
	n := t.M()
	for {
		switch t.peek().typ {
		case itemPlus, itemMinus:
			n = newBinary(t.next(), n, t.M())
		default:
			return n
		}
	}
}

// M is E {( "*" | "/" ) F} in the grammar.
func (t *Tree) M() Node {
	n := t.E()
	for {
		switch t.peek().typ {
		case itemMult, itemDiv, itemMod:
			n = newBinary(t.next(), n, t.E())
		default:
			return n
		}
	}
}

// E is F {( "**" ) F} in the grammar.
func (t *Tree) E() Node {
	n := t.F()
	for {
		switch t.peek().typ {
		case itemPow:
			n = newBinary(t.next(), n, t.F())
		default:
			return n
		}
	}
}

// F is v | "(" O ")" | "!" O | "-" O in the grammar.
func (t *Tree) F() Node {
	switch token := t.peek(); token.typ {
	case itemNumber, itemFunc, itemVar:
		return t.v()
	case itemNot, itemMinus:
		return newUnary(t.next(), t.F())
	case itemLeftParen:
		t.next()
		n := t.O()
		t.expect(itemRightParen, "input: F()")
		return n
	default:
		t.unexpected(token, "input: F()")
	}
	return nil
}

// V is number | func(..) | queryVar in the grammar.
func (t *Tree) v() Node {
	switch token := t.next(); token.typ {
	case itemNumber:
		n, err := newNumber(token.pos, token.val)
		if err != nil {
			t.error(err)
		}
		return n
	case itemFunc:
		t.backup()
		return t.Func()
	case itemVar:
		t.backup()
		return t.Var()
	default:
		t.unexpected(token, "input: v()")
	}
	return nil
}

// Var is queryVar in the grammar.
func (t *Tree) Var() (v *VarNode) {
	token := t.next()
	varNoPrefix := strings.TrimPrefix(token.val, "$")
	varNoBraces := strings.TrimSuffix(strings.TrimPrefix(varNoPrefix, "{"), "}")
	t.VarNames = append(t.VarNames, varNoBraces)
	return newVar(token.pos, varNoBraces, token.val)
}

// Func parses a FuncNode.
func (t *Tree) Func() (f *FuncNode) {
	token := t.next()
	funcv, ok := t.GetFunction(token.val)
	if !ok {
		t.errorf("non existent function %s", token.val)
	}
	f = newFunc(token.pos, token.val, funcv)
	t.expect(itemLeftParen, "func")
	for {
		switch token = t.next(); token.typ {
		default:
			t.backup()
			node := t.O()
			f.append(node)
			if len(f.Args) == 1 && f.F.VariantReturn {
				f.F.Return = node.Return()
			}
		case itemString:
			s, err := strconv.Unquote(token.val)
			if err != nil {
				t.errorf("Unquoting error: %s", err)
			}
			f.append(newString(token.pos, token.val, s))
		case itemRightParen:
			return
		}
	}
}

// GetFunction gets a parsed Func from the functions available on the tree's func property.
func (t *Tree) GetFunction(name string) (v Func, ok bool) {
	for _, funcMap := range t.funcs {
		if funcMap == nil {
			continue
		}
		if v, ok = funcMap[name]; ok {
			return
		}
	}
	return
}

// String returns a string representation of the parse tree.
func (t *Tree) String() string {
	return t.Root.String()
}
