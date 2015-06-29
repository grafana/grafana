// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package parse builds parse trees for expressions as defined by expr. Clients
// should use that package to construct expressions rather than this one, which
// provides shared internal data structures not intended for general use.
package parse // import "bosun.org/cmd/bosun/expr/parse"

import (
	"fmt"
	"runtime"
	"sort"
	"strconv"
	"strings"
)

// Tree is the representation of a single parsed expression.
type Tree struct {
	Text string // text parsed to create the expression.
	Root Node   // top-level root of the tree, returns a number.

	funcs []map[string]Func

	// Parsing only; cleared after parse.
	lex       *lexer
	token     [1]item // one-token lookahead for parser.
	peekCount int
}

type Func struct {
	Args   []FuncType
	Return FuncType
	Tags   func([]Node) (Tags, error)
	F      interface{}
	Check  func(*Tree, *FuncNode) error
}

type FuncType int

func (f FuncType) String() string {
	switch f {
	case TypeNumberSet:
		return "number"
	case TypeString:
		return "string"
	case TypeSeriesSet:
		return "series"
	case TypeScalar:
		return "scalar"
	default:
		return "unknown"
	}
}

const (
	TypeString FuncType = iota
	TypeScalar
	TypeNumberSet
	TypeSeriesSet
)

type Tags map[string]struct{}

func (t Tags) String() string {
	var keys []string
	for k := range t {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return strings.Join(keys, ",")
}

func (t Tags) Equal(o Tags) bool {
	if len(t) != len(o) {
		return false
	}
	for k := range t {
		if _, present := o[k]; !present {
			return false
		}
	}
	return true
}

// Subset returns true if o is a subset of t.
func (t Tags) Subset(o Tags) bool {
	for k := range t {
		if _, ok := o[k]; !ok {
			return false
		}
	}
	return true
}

// Intersection returns Tags common to both tagsets.
func (t Tags) Intersection(o Tags) Tags {
	result := Tags{}
	for k := range t {
		if _, ok := o[k]; ok {
			result[k] = struct{}{}
		}
	}
	return result
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
	return
}

// startParse initializes the parser, using the lexer.
func (t *Tree) startParse(funcs []map[string]Func, lex *lexer) {
	t.Root = nil
	t.lex = lex
	t.funcs = funcs
	for _, funcMap := range funcs {
		for name, f := range funcMap {
			switch f.Return {
			case TypeSeriesSet, TypeNumberSet:
				if f.Tags == nil {
					panic(fmt.Errorf("%v: expected Tags definition: got nil", name))
				}
			default:
				if f.Tags != nil {
					panic(fmt.Errorf("%v: unexpected Tags definition: expected nil", name))
				}
			}
		}
	}
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
	t.expect(itemEOF, "input")
	if err := t.Root.Check(t); err != nil {
		t.error(err)
	}
}

/* Grammar:
O -> A {"||" A}
A -> C {"&&" C}
C -> P {( "==" | "!=" | ">" | ">=" | "<" | "<=") P}
P -> M {( "+" | "-" ) M}
M -> F {( "*" | "/" ) F}
F -> v | "(" O ")" | "!" O | "-" O
v -> number | func(..)
Func -> name "(" param {"," param} ")"
param -> number | "string" | [query]
*/

// expr:
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

func (t *Tree) M() Node {
	n := t.F()
	for {
		switch t.peek().typ {
		case itemMult, itemDiv:
			n = newBinary(t.next(), n, t.F())
		default:
			return n
		}
	}
}

func (t *Tree) F() Node {
	switch token := t.peek(); token.typ {
	case itemNumber, itemFunc:
		return t.v()
	case itemNot, itemMinus:
		return newUnary(t.next(), t.F())
	case itemLeftParen:
		t.next()
		n := t.O()
		t.expect(itemRightParen, "input")
		return n
	default:
		t.unexpected(token, "input")
	}
	return nil
}

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
	default:
		t.unexpected(token, "input")
	}
	return nil
}

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
			f.append(t.O())
		case itemString:
			s, err := strconv.Unquote(token.val)
			if err != nil {
				t.error(err)
			}
			f.append(newString(token.pos, token.val, s))
		case itemRightParen:
			return
		}
		switch token = t.next(); token.typ {
		case itemComma:
			// continue
		case itemRightParen:
			return
		default:
			t.unexpected(token, "func")
		}
	}
}

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

func (t *Tree) String() string {
	return t.Root.String()
}
