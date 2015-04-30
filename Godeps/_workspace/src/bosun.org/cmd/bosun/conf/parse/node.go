// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Parse nodes.

package parse

import (
	"bytes"
	"fmt"
)

var textFormat = "%s" // Changed to "%q" in tests for better error messages.

// A Node is an element in the parse tree. The interface is trivial.
// The interface contains an unexported method so that only
// types local to this package can satisfy it.
type Node interface {
	Type() NodeType
	String() string
	Position() Pos // byte position of start of node in full original input string
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
	NodePair    NodeType = iota // key=value expression.
	NodeList                    // A list of nodes.
	NodeString                  // A string constant.
	NodeSection                 // [section] definition.
)

// Nodes.

// PairNode holds a key=value pair.
type PairNode struct {
	NodeType
	Pos
	Key, Val *StringNode
}

func newPair(pos Pos) *PairNode {
	return &PairNode{NodeType: NodePair, Pos: pos}
}

func (p *PairNode) String() string {
	return fmt.Sprintf("%s = %s", p.Key, p.Val)
}

// ListNode holds a sequence of nodes.
type ListNode struct {
	NodeType
	Pos
	Nodes []Node // The element nodes in lexical order.
}

func newList(pos Pos) *ListNode {
	return &ListNode{NodeType: NodeList, Pos: pos}
}

func (l *ListNode) append(n Node) {
	l.Nodes = append(l.Nodes, n)
}

func (l *ListNode) String() string {
	b := new(bytes.Buffer)
	for _, n := range l.Nodes {
		fmt.Fprintln(b, n)
	}
	return b.String()
}

// SectionNode holds a section name and children
type SectionNode struct {
	NodeType
	Pos
	RawText     string
	SectionType *StringNode
	Name        *StringNode
	Nodes       *ListNode
}

func newSection(pos Pos) *SectionNode {
	return &SectionNode{NodeType: NodeSection, Pos: pos, Nodes: new(ListNode)}
}

func (s *SectionNode) String() string {
	return s.RawText
}

// StringNode holds a string constant. The value has been "unquoted".
type StringNode struct {
	NodeType
	Pos
	Quoted string // The original text of the string, with possible quotes.
	Text   string // The string, after quote processing.
}

func newString(pos Pos, orig, text string) *StringNode {
	return &StringNode{NodeType: NodeString, Pos: pos, Quoted: orig, Text: text}
}

func (s *StringNode) String() string {
	return s.Quoted
}
