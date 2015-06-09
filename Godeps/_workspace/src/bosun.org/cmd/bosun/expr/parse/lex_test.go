// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package parse

import (
	"fmt"
	"testing"
)

// Make the types prettyprint.
var itemName = map[itemType]string{
	itemError:      "error",
	itemEOF:        "EOF",
	itemNot:        "!",
	itemAnd:        "&&",
	itemOr:         "||",
	itemGreater:    ">",
	itemLess:       "<",
	itemGreaterEq:  ">=",
	itemLessEq:     "<=",
	itemEq:         "==",
	itemNotEq:      "!=",
	itemPlus:       "+",
	itemMinus:      "-",
	itemMult:       "*",
	itemDiv:        "/",
	itemNumber:     "number",
	itemComma:      ",",
	itemLeftParen:  "(",
	itemRightParen: ")",
	itemString:     "string",
	itemFunc:       "func",
}

func (i itemType) String() string {
	s := itemName[i]
	if s == "" {
		return fmt.Sprintf("item%d", int(i))
	}
	return s
}

type lexTest struct {
	name  string
	input string
	items []item
}

var (
	tEOF   = item{itemEOF, 0, ""}
	tLpar  = item{itemLeftParen, 0, "("}
	tRpar  = item{itemRightParen, 0, ")"}
	tComma = item{itemComma, 0, ","}
	tLt    = item{itemLess, 0, "<"}
	tGt    = item{itemGreater, 0, ">"}
	tOr    = item{itemOr, 0, "||"}
	tNot   = item{itemNot, 0, "!"}
	tAnd   = item{itemAnd, 0, "&&"}
	tLtEq  = item{itemLessEq, 0, "<="}
	tGtEq  = item{itemGreaterEq, 0, ">="}
	tNotEq = item{itemNotEq, 0, "!="}
	tEq    = item{itemEq, 0, "=="}
	tPlus  = item{itemPlus, 0, "+"}
	tMinus = item{itemMinus, 0, "-"}
	tMult  = item{itemMult, 0, "*"}
	tDiv   = item{itemDiv, 0, "/"}
)

var lexTests = []lexTest{
	{"empty", "", []item{tEOF}},
	{"spaces", " \t\n", []item{tEOF}},
	{"text", `"now is the time"`, []item{{itemString, 0, `"now is the time"`}, tEOF}},
	{"operators", "! && || < > <= >= == != + - * /", []item{
		tNot,
		tAnd,
		tOr,
		tLt,
		tGt,
		tLtEq,
		tGtEq,
		tEq,
		tNotEq,
		tPlus,
		tMinus,
		tMult,
		tDiv,
		tEOF,
	}},
	{"numbers", "1 02 0x14 7.2 1e3 1.2e-4", []item{
		{itemNumber, 0, "1"},
		{itemNumber, 0, "02"},
		{itemNumber, 0, "0x14"},
		{itemNumber, 0, "7.2"},
		{itemNumber, 0, "1e3"},
		{itemNumber, 0, "1.2e-4"},
		tEOF,
	}},
	{"expression", `avg(q("sum:sys.cpu.user{host=*-web*}", "1m")) < 0.2 || avg(q("sum:sys.cpu.user{host=*-web*}", "1m")) > 0.4`, []item{
		{itemFunc, 0, "avg"},
		tLpar,
		{itemFunc, 0, "q"},
		tLpar,
		{itemString, 0, `"sum:sys.cpu.user{host=*-web*}"`},
		tComma,
		{itemString, 0, `"1m"`},
		tRpar,
		tRpar,
		tLt,
		{itemNumber, 0, "0.2"},
		tOr,
		{itemFunc, 0, "avg"},
		tLpar,
		{itemFunc, 0, "q"},
		tLpar,
		{itemString, 0, `"sum:sys.cpu.user{host=*-web*}"`},
		tComma,
		{itemString, 0, `"1m"`},
		tRpar,
		tRpar,
		tGt,
		{itemNumber, 0, "0.4"},
		tEOF,
	}},
	// errors
	{"unclosed quote", "\"", []item{
		{itemError, 0, "unterminated string"},
	}},
}

// collect gathers the emitted items into a slice.
func collect(t *lexTest) (items []item) {
	l := lex(t.input)
	for {
		item := l.nextItem()
		items = append(items, item)
		if item.typ == itemEOF || item.typ == itemError {
			break
		}
	}
	return
}

func equal(i1, i2 []item, checkPos bool) bool {
	if len(i1) != len(i2) {
		return false
	}
	for k := range i1 {
		if i1[k].typ != i2[k].typ {
			return false
		}
		if i1[k].val != i2[k].val {
			return false
		}
		if checkPos && i1[k].pos != i2[k].pos {
			return false
		}
	}
	return true
}

func TestLex(t *testing.T) {
	for _, test := range lexTests {
		items := collect(&test)
		if !equal(items, test.items, false) {
			t.Errorf("%s: got\n\t%+v\nexpected\n\t%v", test.name, items, test.items)
		}
	}
}

/*
var lexPosTests = []lexTest{
	{"empty", "", []item{tEOF}},
	{"punctuation", "{{,@%#}}", []item{
		{itemLeftDelim, 0, "{{"},
		{itemChar, 2, ","},
		{itemChar, 3, "@"},
		{itemChar, 4, "%"},
		{itemChar, 5, "#"},
		{itemRightDelim, 6, "}}"},
		{itemEOF, 8, ""},
	}},
	{"sample", "0123{{hello}}xyz", []item{
		{itemText, 0, "0123"},
		{itemLeftDelim, 4, "{{"},
		{itemIdentifier, 6, "hello"},
		{itemRightDelim, 11, "}}"},
		{itemText, 13, "xyz"},
		{itemEOF, 16, ""},
	}},
}

// The other tests don't check position, to make the test cases easier to construct.
// This one does.
func TestPos(t *testing.T) {
	for _, test := range lexPosTests {
		items := collect(&test, "", "")
		if !equal(items, test.items, true) {
			t.Errorf("%s: got\n\t%v\nexpected\n\t%v", test.name, items, test.items)
			if len(items) == len(test.items) {
				// Detailed print; avoid item.String() to expose the position value.
				for i := range items {
					if !equal(items[i:i+1], test.items[i:i+1], true) {
						i1 := items[i]
						i2 := test.items[i]
						t.Errorf("\t#%d: got {%v %d %q} expected  {%v %d %q}", i, i1.typ, i1.pos, i1.val, i2.typ, i2.pos, i2.val)
					}
				}
			}
		}
	}
}
*/
