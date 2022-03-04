// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package parse

import (
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

// item represents a token or text string returned from the scanner.
type item struct {
	typ itemType // The type of this item.
	pos Pos      // The starting position, in bytes, of this item in the input string.
	val string   // The value of this item.
}

func (i item) String() string {
	switch {
	case i.typ == itemEOF:
		return "EOF"
	case i.typ == itemError:
		return i.val
	case len(i.val) > 10:
		return fmt.Sprintf("%.10q...", i.val)
	}
	return fmt.Sprintf("%q", i.val)
}

// itemType identifies the type of lex items.
type itemType int

const (
	itemError itemType = iota // error occurred; value is text of error
	itemEOF
	itemNot       // '!'
	itemAnd       // '&&'
	itemOr        // '||'
	itemGreater   // '>'
	itemLess      // '<'
	itemGreaterEq // '>='
	itemLessEq    // '<='
	itemEq        // '=='
	itemNotEq     // '!='
	itemPlus      // '+'
	itemMinus     // '-'
	itemMult      // '*'
	itemDiv       // '/'
	itemMod       // '%'
	itemNumber    // simple number
	itemComma
	itemLeftParen
	itemRightParen
	itemString
	itemFunc
	itemVar // e.g. $A
	itemPow // '**'
)

const eof = -1

// stateFn represents the state of the scanner as a function that returns the next state.
type stateFn func(*lexer) stateFn

// lexer holds the state of the scanner.
type lexer struct {
	input   string    // the string being scanned
	state   stateFn   // the next lexing function to enter
	pos     Pos       // current position in the input
	start   Pos       // start position of this item
	width   Pos       // width of last rune read from input
	lastPos Pos       // position of most recent item returned by nextItem
	items   chan item // channel of scanned items
}

// next returns the next rune in the input.
func (l *lexer) next() rune {
	if int(l.pos) >= len(l.input) {
		l.width = 0
		return eof
	}
	r, w := utf8.DecodeRuneInString(l.input[l.pos:])
	l.width = Pos(w)
	l.pos += l.width
	return r
}

// peek returns but does not consume the next rune in the input.
// nolint:unused
func (l *lexer) peek() rune {
	r := l.next()
	l.backup()
	return r
}

// backup steps back one rune. Can only be called once per call of next.
func (l *lexer) backup() {
	l.pos -= l.width
}

// emit passes an item back to the client.
func (l *lexer) emit(t itemType) {
	l.items <- item{t, l.start, l.input[l.start:l.pos]}
	l.start = l.pos
}

// accept consumes the next rune if it's from the valid set.
func (l *lexer) accept(valid string) bool {
	if strings.ContainsRune(valid, l.next()) {
		return true
	}
	l.backup()
	return false
}

// acceptRun consumes a run of runes from the valid set.
func (l *lexer) acceptRun(valid string) {
	for strings.ContainsRune(valid, l.next()) {
	}
	l.backup()
}

// ignore skips over the pending input before this point.
func (l *lexer) ignore() {
	l.start = l.pos
}

// lineNumber reports which line we're on, based on the position of
// the previous item returned by nextItem. Doing it this way
// means we don't have to worry about peek double counting.
// nolint:unused
func (l *lexer) lineNumber() int {
	return 1 + strings.Count(l.input[:l.lastPos], "\n")
}

// errorf returns an error token and terminates the scan by passing
// back a nil pointer that will be the next state, terminating l.nextItem.
func (l *lexer) errorf(format string, args ...interface{}) stateFn {
	l.items <- item{itemError, l.start, fmt.Sprintf(format, args...)}
	return nil
}

// nextItem returns the next item from the input.
func (l *lexer) nextItem() item {
	item := <-l.items
	l.lastPos = item.pos
	return item
}

// lex creates a new scanner for the input string.
func lex(input string) *lexer {
	l := &lexer{
		input: input,
		items: make(chan item),
	}
	go l.run()
	return l
}

// run runs the state machine for the lexer.
func (l *lexer) run() {
	for l.state = lexItem; l.state != nil; {
		l.state = l.state(l)
	}
}

// state functions

func lexItem(l *lexer) stateFn {
Loop:
	for {
		switch r := l.next(); {
		case r == '$':
			return lexVar
		case isSymbol(r):
			return lexSymbol
		case isNumber(r):
			l.backup()
			return lexNumber
		case unicode.IsLetter(r):
			return lexFunc
		case r == '(':
			l.emit(itemLeftParen)
		case r == ')':
			l.emit(itemRightParen)
		case r == '"':
			return lexString
		case r == ',':
			l.emit(itemComma)
		case isSpace(r):
			l.ignore()
		case r == eof:
			l.emit(itemEOF)
			break Loop
		default:
			return l.errorf("invalid character: %s", string(r))
		}
	}
	return nil
}

// lexNumber scans a number: decimal, octal, hex, float, or imaginary. This
// isn't a perfect number scanner - for instance it accepts "." and "0x0.2"
// and "089" - but when it's wrong the input is invalid and the parser (via
// strconv) will notice.
func lexNumber(l *lexer) stateFn {
	if !l.scanNumber() {
		return l.errorf("bad number syntax: %q", l.input[l.start:l.pos])
	}
	l.emit(itemNumber)
	return lexItem
}

func (l *lexer) scanNumber() bool {
	// Is it hex?
	digits := "0123456789"
	if l.accept("0") && l.accept("xX") {
		digits = "0123456789abcdefABCDEF"
	}
	l.acceptRun(digits)
	if l.accept(".") {
		l.acceptRun(digits)
	}
	if l.accept("eE") {
		l.accept("+-")
		l.acceptRun("0123456789")
	}
	return true
}

const symbols = "!<>=&|+-*/%"

func lexSymbol(l *lexer) stateFn {
	l.acceptRun(symbols)
	s := l.input[l.start:l.pos]
	switch s {
	case "!":
		l.emit(itemNot)
	case "&&":
		l.emit(itemAnd)
	case "||":
		l.emit(itemOr)
	case ">":
		l.emit(itemGreater)
	case "<":
		l.emit(itemLess)
	case ">=":
		l.emit(itemGreaterEq)
	case "<=":
		l.emit(itemLessEq)
	case "==":
		l.emit(itemEq)
	case "!=":
		l.emit(itemNotEq)
	case "+":
		l.emit(itemPlus)
	case "-":
		l.emit(itemMinus)
	case "*":
		l.emit(itemMult)
	case "**":
		l.emit(itemPow)
	case "/":
		l.emit(itemDiv)
	case "%":
		l.emit(itemMod)
	default:
		l.emit(itemError)
	}
	return lexItem
}

func lexFunc(l *lexer) stateFn {
	for {
		switch r := l.next(); {
		case unicode.IsLetter(r) || r == '_':
			// absorb
		default:
			l.backup()
			l.emit(itemFunc)
			return lexItem
		}
	}
}

func lexVar(l *lexer) stateFn {
	hasChar := false
	if l.peek() == '{' {
		_ = l.next()
		for {
			switch r := l.next(); {
			case r == '}':
				if !hasChar {
					return l.errorf("incomplete variable")
				}
				l.emit(itemVar)
				return lexItem
			case r == eof:
				return l.errorf("unterminated variable missing closing }")
			case isVarchar(r) || isSpace(r):
				hasChar = true
			default:
				return l.errorf("unsupported variable character")
			}
		}
	}

	for {
		switch r := l.next(); {
		case isVarchar(r):
			hasChar = true
			// absorb
		default:
			if !hasChar {
				return l.errorf("incomplete variable")
			}
			l.backup()
			l.emit(itemVar)
			return lexItem
		}
	}
}

func lexString(l *lexer) stateFn {
	for {
		switch l.next() {
		case '"':
			l.emit(itemString)
			return lexItem
		case eof:
			return l.errorf("unterminated string")
		}
	}
}

// isSpace reports whether r is a space character.
func isSpace(r rune) bool {
	return unicode.IsSpace(r)
}

func isVarchar(r rune) bool {
	return r == '_' || unicode.IsLetter(r) || unicode.IsDigit(r)
}

func isSymbol(r rune) bool {
	return strings.ContainsRune(symbols, r)
}

func isNumber(r rune) bool {
	return unicode.IsDigit(r) || r == '.'
}
