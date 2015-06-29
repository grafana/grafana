// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Parse nodes.

package parse

import (
	"fmt"
	"strconv"
)

var textFormat = "%s" // Changed to "%q" in tests for better error messages.

// A Node is an element in the parse tree. The interface is trivial.
// The interface contains an unexported method so that only
// types local to this package can satisfy it.
type Node interface {
	Type() NodeType
	String() string
	StringAST() string
	Position() Pos     // byte position of start of node in full original input string
	Check(*Tree) error // performs type checking for itself and sub-nodes
	Return() FuncType
	Tags() (Tags, error)
	// Make sure only functions in this package can create Nodes.
	unexported()
}

// NodeType identifies the type of a parse tree node.
type NodeType int

// Pos represents a byte position in the original input text from which
// this template was parsed.
type Pos int

func (p Pos) Position() Pos {
	return p
}

// unexported keeps Node implementations local to the package.
// All implementations embed Pos, so this takes care of it.
func (Pos) unexported() {
}

// Type returns itself and provides an easy default implementation
// for embedding in a Node. Embedded in all non-trivial Nodes.
func (t NodeType) Type() NodeType {
	return t
}

const (
	NodeFunc   NodeType = iota // A function call.
	NodeBinary                 // Binary operator: math, logical, compare
	NodeUnary                  // Unary operator: !, -
	NodeString                 // A string constant.
	NodeNumber                 // A numerical constant.
)

// Nodes.

// FuncNode holds a function invocation.
type FuncNode struct {
	NodeType
	Pos
	Name string
	F    Func
	Args []Node
}

func newFunc(pos Pos, name string, f Func) *FuncNode {
	return &FuncNode{NodeType: NodeFunc, Pos: pos, Name: name, F: f}
}

func (f *FuncNode) append(arg Node) {
	f.Args = append(f.Args, arg)
}

func (f *FuncNode) String() string {
	s := f.Name + "("
	for i, arg := range f.Args {
		if i > 0 {
			s += ", "
		}
		s += arg.String()
	}
	s += ")"
	return s
}

func (f *FuncNode) StringAST() string {
	s := f.Name + "("
	for i, arg := range f.Args {
		if i > 0 {
			s += ", "
		}
		s += arg.StringAST()
	}
	s += ")"
	return s
}

func (f *FuncNode) Check(t *Tree) error {
	const errFuncType = "parse: bad argument type in %s, expected %s, got %s"
	if len(f.Args) < len(f.F.Args) {
		return fmt.Errorf("parse: not enough arguments for %s", f.Name)
	} else if len(f.Args) > len(f.F.Args) {
		return fmt.Errorf("parse: too many arguments for %s", f.Name)
	}
	for i, a := range f.Args {
		ft := f.F.Args[i]
		at := a.Return()
		if ft != at {
			return fmt.Errorf("parse: expected %v, got %v", ft, at)
		}
		if err := a.Check(t); err != nil {
			return err
		}
	}
	if f.F.Check != nil {
		return f.F.Check(t, f)
	}
	return nil
}

func (f *FuncNode) Return() FuncType {
	return f.F.Return
}

func (f *FuncNode) Tags() (Tags, error) {
	if f.F.Tags == nil {
		return nil, nil
	}
	return f.F.Tags(f.Args)
}

// NumberNode holds a number: signed or unsigned integer or float.
// The value is parsed and stored under all the types that can represent the value.
// This simulates in a small amount of code the behavior of Go's ideal constants.
type NumberNode struct {
	NodeType
	Pos
	IsUint  bool    // Number has an unsigned integral value.
	IsFloat bool    // Number has a floating-point value.
	Uint64  uint64  // The unsigned integer value.
	Float64 float64 // The floating-point value.
	Text    string  // The original textual representation from the input.
}

func newNumber(pos Pos, text string) (*NumberNode, error) {
	n := &NumberNode{NodeType: NodeNumber, Pos: pos, Text: text}
	// Do integer test first so we get 0x123 etc.
	u, err := strconv.ParseUint(text, 0, 64) // will fail for -0.
	if err == nil {
		n.IsUint = true
		n.Uint64 = u
	}
	// If an integer extraction succeeded, promote the float.
	if n.IsUint {
		n.IsFloat = true
		n.Float64 = float64(n.Uint64)
	} else {
		f, err := strconv.ParseFloat(text, 64)
		if err == nil {
			n.IsFloat = true
			n.Float64 = f
			// If a floating-point extraction succeeded, extract the int if needed.
			if !n.IsUint && float64(uint64(f)) == f {
				n.IsUint = true
				n.Uint64 = uint64(f)
			}
		}
	}
	if !n.IsUint && !n.IsFloat {
		return nil, fmt.Errorf("illegal number syntax: %q", text)
	}
	return n, nil
}

func (n *NumberNode) String() string {
	return n.Text
}

func (n *NumberNode) StringAST() string {
	return n.String()
}

func (n *NumberNode) Check(*Tree) error {
	return nil
}

func (n *NumberNode) Return() FuncType {
	return TypeScalar
}

func (n *NumberNode) Tags() (Tags, error) {
	return nil, nil
}

// StringNode holds a string constant. The value has been "unquoted".
type StringNode struct {
	NodeType
	Pos
	Quoted string // The original text of the string, with quotes.
	Text   string // The string, after quote processing.
}

func newString(pos Pos, orig, text string) *StringNode {
	return &StringNode{NodeType: NodeString, Pos: pos, Quoted: orig, Text: text}
}

func (s *StringNode) String() string {
	return s.Quoted
}

func (s *StringNode) StringAST() string {
	return s.String()
}

func (s *StringNode) Check(*Tree) error {
	return nil
}

func (s *StringNode) Return() FuncType {
	return TypeString
}

func (s *StringNode) Tags() (Tags, error) {
	return nil, nil
}

// BinaryNode holds two arguments and an operator.
type BinaryNode struct {
	NodeType
	Pos
	Args     [2]Node
	Operator item
	OpStr    string
}

func newBinary(operator item, arg1, arg2 Node) *BinaryNode {
	return &BinaryNode{NodeType: NodeBinary, Pos: operator.pos, Args: [2]Node{arg1, arg2}, Operator: operator, OpStr: operator.val}
}

func (b *BinaryNode) String() string {
	return fmt.Sprintf("%s %s %s", b.Args[0], b.Operator.val, b.Args[1])
}

func (b *BinaryNode) StringAST() string {
	return fmt.Sprintf("%s(%s, %s)", b.Operator.val, b.Args[0], b.Args[1])
}

func (b *BinaryNode) Check(t *Tree) error {
	t1 := b.Args[0].Return()
	t2 := b.Args[1].Return()
	if t1 == TypeSeriesSet && t2 == TypeSeriesSet {
		return fmt.Errorf("parse: type error in %s: at least one side must be a number", b)
	}
	check := t1
	if t1 == TypeSeriesSet {
		check = t2
	}
	if check != TypeNumberSet && check != TypeScalar {
		return fmt.Errorf("parse: type error in %s: expected a number", b)
	}
	if err := b.Args[0].Check(t); err != nil {
		return err
	}
	if err := b.Args[1].Check(t); err != nil {
		return err
	}
	g1, err := b.Args[0].Tags()
	if err != nil {
		return err
	}
	g2, err := b.Args[1].Tags()
	if err != nil {
		return err
	}
	if g1 != nil && g2 != nil && !g1.Subset(g2) && !g2.Subset(g1) {
		return fmt.Errorf("parse: incompatible tags (%v and %v) in %s", g1, g2, b)
	}
	return nil
}

func (b *BinaryNode) Return() FuncType {
	t0 := b.Args[0].Return()
	t1 := b.Args[1].Return()
	if t1 > t0 {
		return t1
	}
	return t0
}

func (b *BinaryNode) Tags() (Tags, error) {
	t, err := b.Args[0].Tags()
	if err != nil {
		return nil, err
	}
	if t == nil {
		return b.Args[1].Tags()
	}
	return t, nil
}

// UnaryNode holds one argument and an operator.
type UnaryNode struct {
	NodeType
	Pos
	Arg      Node
	Operator item
	OpStr    string
}

func newUnary(operator item, arg Node) *UnaryNode {
	return &UnaryNode{NodeType: NodeUnary, Pos: operator.pos, Arg: arg, Operator: operator, OpStr: operator.val}
}

func (u *UnaryNode) String() string {
	return fmt.Sprintf("%s%s", u.Operator.val, u.Arg)
}

func (u *UnaryNode) StringAST() string {
	return fmt.Sprintf("%s(%s)", u.Operator.val, u.Arg)
}

func (u *UnaryNode) Check(t *Tree) error {
	switch rt := u.Arg.Return(); rt {
	case TypeNumberSet, TypeSeriesSet, TypeScalar:
		return u.Arg.Check(t)
	default:
		return fmt.Errorf("parse: type error in %s, expected %s, got %s", u, "number", rt)
	}
}

func (u *UnaryNode) Return() FuncType {
	return u.Arg.Return()
}

func (u *UnaryNode) Tags() (Tags, error) {
	return u.Arg.Tags()
}

// Walk invokes f on n and sub-nodes of n.
func Walk(n Node, f func(Node)) {
	f(n)
	switch n := n.(type) {
	case *BinaryNode:
		Walk(n.Args[0], f)
		Walk(n.Args[1], f)
	case *FuncNode:
		for _, a := range n.Args {
			Walk(a, f)
		}
	case *NumberNode, *StringNode:
		// Ignore.
	case *UnaryNode:
		Walk(n.Arg, f)
	default:
		panic(fmt.Errorf("other type: %T", n))
	}
}
