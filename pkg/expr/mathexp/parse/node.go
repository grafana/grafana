// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Parse nodes.

package parse

import (
	"fmt"
	"strconv"
)

// A Node is an element in the parse tree. The interface is trivial.
// The interface contains an unexported method so that only
// types local to this package can satisfy it.
type Node interface {
	Type() NodeType
	String() string
	StringAST() string
	Position() Pos     // byte position of start of node in full original input string
	Check(*Tree) error // performs type checking for itself and sub-nodes
	Return() ReturnType

	// Make sure only functions in this package can create Nodes.
	unexported()
}

// NodeType identifies the type of a parse tree node.
type NodeType int

// Pos represents a byte position in the original input text from which
// this template was parsed.
type Pos int

// Position returns the integer Position of p
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
	// NodeFunc is a function call.
	NodeFunc NodeType = iota
	// NodeBinary is a binary operator: math, logical, compare
	NodeBinary
	// NodeUnary is unary operator: !, -
	NodeUnary
	// NodeString is string constant.
	NodeString
	// NodeNumber is a numerical constant (Scalar).
	NodeNumber
	// NodeVar is variable: $A
	NodeVar
)

// String returns the string representation of the NodeType
func (t NodeType) String() string {
	switch t {
	case NodeFunc:
		return "NodeFunc"
	case NodeBinary:
		return "NodeBinary"
	case NodeUnary:
		return "NodeUnary"
	case NodeString:
		return "NodeString"
	case NodeNumber:
		return "NodeNumber"
	case NodeVar:
		return "NodeVar"
	default:
		return "NodeUnknown"
	}
}

// Nodes.

// VarNode holds a variable reference.
type VarNode struct {
	NodeType
	Pos
	Name string // Without the $ or {}
	Text string // Raw
}

func newVar(pos Pos, name, text string) *VarNode {
	return &VarNode{NodeType: NodeVar, Pos: pos, Name: name, Text: text}
}

// Type returns the Type of the VarNode so it fulfills the Node interface.
func (n *VarNode) Type() NodeType { return NodeVar }

// String returns the string representation of the VarNode so it fulfills the Node interface.
func (n *VarNode) String() string { return n.Text }

// StringAST returns the string representation of abstract syntax tree of the VarNode so it fulfills the Node interface.
func (n *VarNode) StringAST() string { return n.String() }

// Check performs parse time checking on the VarNode so it fulfills the Node interface.
func (n *VarNode) Check(*Tree) error {
	return nil
}

// Return returns the result type of the VarNode so it fulfills the Node interface.
func (n *VarNode) Return() ReturnType {
	return TypeSeriesSet // Vars are only time series for now I guess....
}

// FuncNode holds a function invocation.
type FuncNode struct {
	NodeType
	Pos
	Name   string
	F      *Func
	Args   []Node
	Prefix string
}

func newFunc(pos Pos, name string, f Func) *FuncNode {
	return &FuncNode{NodeType: NodeFunc, Pos: pos, Name: name, F: &f}
}

func (f *FuncNode) append(arg Node) {
	f.Args = append(f.Args, arg)
}

// String returns the string representation of the FuncNode so it fulfills the Node interface.
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

// StringAST returns the string representation of abstract syntax tree of the FuncNode so it fulfills the Node interface.
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

// Check performs parse time checking on the FuncNode so it fulfills the Node interface.
func (f *FuncNode) Check(t *Tree) error {
	if len(f.Args) < len(f.F.Args) {
		return fmt.Errorf("parse: not enough arguments for %s", f.Name)
	} else if len(f.Args) > len(f.F.Args) {
		return fmt.Errorf("parse: too many arguments for %s", f.Name)
	}

	for i, arg := range f.Args {
		funcType := f.F.Args[i]
		argType := arg.Return()
		// if funcType == TypeNumberSet && argType == TypeScalar {
		// 	argType = TypeNumberSet
		// }
		if funcType == TypeVariantSet {
			if argType != TypeNumberSet && argType != TypeSeriesSet && argType != TypeScalar {
				return fmt.Errorf("parse: expected %v or %v for argument %v, got %v", TypeNumberSet, TypeSeriesSet, i, argType)
			}
		} else if funcType != argType {
			return fmt.Errorf("parse: expected %v, got %v for argument %v (%v)", funcType, argType, i, arg.String())
		}
		if err := arg.Check(t); err != nil {
			return err
		}
	}

	if f.F.Check != nil {
		return f.F.Check(t, f)
	}
	return nil
}

// Return returns the result type of the FuncNode so it fulfills the Node interface.
func (f *FuncNode) Return() ReturnType {
	return f.F.Return
}

// ScalarNode holds a number: signed or unsigned integer or float.
// The value is parsed and stored under all the types that can represent the value.
// This simulates in a small amount of code the behavior of Go's ideal constants.
type ScalarNode struct {
	NodeType
	Pos
	IsUint  bool    // Number has an unsigned integral value.
	IsFloat bool    // Number has a floating-point value.
	Uint64  uint64  // The unsigned integer value.
	Float64 float64 // The floating-point value.
	Text    string  // The original textual representation from the input.
}

func newNumber(pos Pos, text string) (*ScalarNode, error) {
	n := &ScalarNode{NodeType: NodeNumber, Pos: pos, Text: text}
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

// String returns the string representation of the ScalarNode so it fulfills the Node interface.
func (n *ScalarNode) String() string {
	return n.Text
}

// StringAST returns the string representation of abstract syntax tree of the ScalarNode so it fulfills the Node interface.
func (n *ScalarNode) StringAST() string {
	return n.String()
}

// Check performs parse time checking on the ScalarNode so it fulfills the Node interface.
func (n *ScalarNode) Check(*Tree) error {
	return nil
}

// Return returns the result type of the ScalarNode so it fulfills the Node interface.
func (n *ScalarNode) Return() ReturnType {
	return TypeScalar
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

// String returns the string representation of the StringNode so it fulfills the Node interface.
func (s *StringNode) String() string {
	return s.Quoted
}

// StringAST returns the string representation of abstract syntax tree of the StringNode so it fulfills the Node interface.
func (s *StringNode) StringAST() string {
	return s.String()
}

// Check performs parse time checking on the StringNode so it fulfills the Node interface.
func (s *StringNode) Check(*Tree) error {
	return nil
}

// Return returns the result type of the TypeString so it fulfills the Node interface.
func (s *StringNode) Return() ReturnType {
	return TypeString
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

// String returns the string representation of the BinaryNode so it fulfills the Node interface.
func (b *BinaryNode) String() string {
	return fmt.Sprintf("%s %s %s", b.Args[0], b.Operator.val, b.Args[1])
}

// StringAST returns the string representation of abstract syntax tree of the BinaryNode so it fulfills the Node interface.
func (b *BinaryNode) StringAST() string {
	return fmt.Sprintf("%s(%s, %s)", b.Operator.val, b.Args[0], b.Args[1])
}

// Check performs parse time checking on the BinaryNode so it fulfills the Node interface.
func (b *BinaryNode) Check(t *Tree) error {
	return nil
}

// Return returns the result type of the BinaryNode so it fulfills the Node interface.
func (b *BinaryNode) Return() ReturnType {
	t0 := b.Args[0].Return()
	t1 := b.Args[1].Return()
	if t1 > t0 {
		return t1
	}
	return t0
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

// String returns the string representation of the UnaryNode so it fulfills the Node interface.
func (u *UnaryNode) String() string {
	return fmt.Sprintf("%s%s", u.Operator.val, u.Arg)
}

// StringAST returns the string representation of abstract syntax tree of the UnaryNode so it fulfills the Node interface.
func (u *UnaryNode) StringAST() string {
	return fmt.Sprintf("%s(%s)", u.Operator.val, u.Arg)
}

// Check performs parse time checking on the UnaryNode so it fulfills the Node interface.
func (u *UnaryNode) Check(t *Tree) error {
	switch rt := u.Arg.Return(); rt {
	case TypeNumberSet, TypeSeriesSet, TypeScalar:
		return u.Arg.Check(t)
	default:
		return fmt.Errorf(`parse: type error in %s, expected "number", got %s`, u, rt)
	}
}

// Return returns the result type of the UnaryNode so it fulfills the Node interface.
func (u *UnaryNode) Return() ReturnType {
	return u.Arg.Return()
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
	case *ScalarNode, *StringNode:
		// Ignore since these node types have no sub nodes.
	case *UnaryNode:
		Walk(n.Arg, f)
	default:
		panic(fmt.Errorf("other type: %T", n))
	}
}

// ReturnType represents the type that is returned from a node.
type ReturnType int

const (
	// TypeString is a single string.
	TypeString ReturnType = iota
	// TypeScalar is a unlabled number constant.
	TypeScalar
	// TypeNumberSet is a collection of labelled numbers.
	TypeNumberSet
	// TypeSeriesSet is a collection of labelled time series.
	TypeSeriesSet
	// TypeVariantSet is a collection of the same type Number, Series, or Scalar.
	TypeVariantSet
	// TypeNoData is a no data response without a known data type.
	TypeNoData
	// TypeTableData is a tabular data response.
	TypeTableData
)

// String returns a string representation of the ReturnType.
func (f ReturnType) String() string {
	switch f {
	case TypeNumberSet:
		return "numberSet"
	case TypeString:
		return "string"
	case TypeSeriesSet:
		return "seriesSet"
	case TypeScalar:
		return "scalar"
	case TypeVariantSet:
		return "variant"
	case TypeNoData:
		return "noData"
	case TypeTableData:
		return "tableData"
	default:
		return "unknown"
	}
}
