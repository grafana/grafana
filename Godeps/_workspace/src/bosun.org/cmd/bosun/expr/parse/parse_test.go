// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package parse

import (
	"flag"
	"fmt"
	"testing"
)

var debug = flag.Bool("debug", false, "show the errors produced by the main tests")

type numberTest struct {
	text    string
	isInt   bool
	isUint  bool
	isFloat bool
	int64
	uint64
	float64
}

var numberTests = []numberTest{
	// basics
	{"0", true, true, true, 0, 0, 0},
	{"73", true, true, true, 73, 73, 73},
	{"073", true, true, true, 073, 073, 073},
	{"0x73", true, true, true, 0x73, 0x73, 0x73},
	{"100", true, true, true, 100, 100, 100},
	{"1e9", true, true, true, 1e9, 1e9, 1e9},
	{"1e19", false, true, true, 0, 1e19, 1e19},
	// funny bases
	{"0123", true, true, true, 0123, 0123, 0123},
	{"0xdeadbeef", true, true, true, 0xdeadbeef, 0xdeadbeef, 0xdeadbeef},
	// some broken syntax
	{text: "+-2"},
	{text: "0x123."},
	{text: "1e."},
	{text: "'x"},
	{text: "'xx'"},
}

func TestNumberParse(t *testing.T) {
	for _, test := range numberTests {
		n, err := newNumber(0, test.text)
		ok := test.isInt || test.isUint || test.isFloat
		if ok && err != nil {
			t.Errorf("unexpected error for %q: %s", test.text, err)
			continue
		}
		if !ok && err == nil {
			t.Errorf("expected error for %q", test.text)
			continue
		}
		if !ok {
			if *debug {
				fmt.Printf("%s\n\t%s\n", test.text, err)
			}
			continue
		}
		if test.isUint {
			if !n.IsUint {
				t.Errorf("expected unsigned integer for %q", test.text)
			}
			if n.Uint64 != test.uint64 {
				t.Errorf("uint64 for %q should be %d Is %d", test.text, test.uint64, n.Uint64)
			}
		} else if n.IsUint {
			t.Errorf("did not expect unsigned integer for %q", test.text)
		}
		if test.isFloat {
			if !n.IsFloat {
				t.Errorf("expected float for %q", test.text)
			}
			if n.Float64 != test.float64 {
				t.Errorf("float64 for %q should be %g Is %g", test.text, test.float64, n.Float64)
			}
		} else if n.IsFloat {
			t.Errorf("did not expect float for %q", test.text)
		}
	}
}

type parseTest struct {
	name   string
	input  string
	ok     bool
	result string // what the user would see in an error message.
}

const (
	noError  = true
	hasError = false
)

var parseTests = []parseTest{
	{"number", "1", noError, "1"},
	{"function", `avg(q("test", "1m"))`, noError, `avg(q("test", "1m"))`},
	{"addition", "1+2", noError, "1 + 2"},
	{"expression", "1+2*3/4-5 && !2|| -4", noError, "1 + 2 * 3 / 4 - 5 && !2 || -4"},
	{"expression with func", `avg(q("q", "1m"))>=0.7&&avg(q("q", "1m"))!=3-0x8`, noError,
		`avg(q("q", "1m")) >= 0.7 && avg(q("q", "1m")) != 3 - 0x8`},
	{"func types", `avg(q("q", "1m"))>avg(q("q", "1m"))+avg(q("q", "1m"))`, noError, `avg(q("q", "1m")) > avg(q("q", "1m")) + avg(q("q", "1m"))`},
	{"series compare", `q("q", "1m")>0`, noError, `q("q", "1m") > 0`},
	{"unary series", `!q("q", "1m")`, noError, `!q("q", "1m")`},
	{"expr in func", `forecastlr(q("q", "1m"), -1)`, noError, `forecastlr(q("q", "1m"), -1)`},
	{"nested func expr", `avg(q("q","1m")>0)`, noError, `avg(q("q", "1m") > 0)`},
	// Errors.
	{"empty", "", hasError, ""},
	{"unclosed function", "avg(", hasError, ""},
	{"bad function", "bad(1)", hasError, ""},
	{"bad type", `band("q", "1h", "1m", "8")`, hasError, ""},
	{"wrong number args", `avg(q("q", "1m"), "1m", 1)`, hasError, ""},
	{"2 series math", `band(q("q", "1m"))+band(q("q", "1m"))`, hasError, ""},
}

func TestParse(t *testing.T) {
	textFormat = "%q"
	defer func() { textFormat = "%s" }()
	for _, test := range parseTests {
		tmpl := New(nil)
		err := tmpl.Parse(test.input, builtins)
		switch {
		case err == nil && !test.ok:
			t.Errorf("%q: expected error; got none", test.name)
			continue
		case err != nil && test.ok:
			t.Errorf("%q: unexpected error: %v", test.name, err)
			continue
		case err != nil && !test.ok:
			// expected error, got one
			if *debug {
				fmt.Printf("%s: %s\n\t%s\n", test.name, test.input, err)
			}
			continue
		}
		var result string
		result = tmpl.Root.String()
		if result != test.result {
			t.Errorf("%s=(%q): got\n\t%v\nexpected\n\t%v", test.name, test.input, result, test.result)
		}
	}
}

func tagNil(args []Node) (Tags, error) {
	return nil, nil
}

var builtins = map[string]Func{
	"avg": {
		[]FuncType{TypeSeriesSet},
		TypeNumberSet,
		tagNil,
		nil,
		nil,
	},
	"band": {
		[]FuncType{TypeString, TypeString, TypeString, TypeScalar},
		TypeSeriesSet,
		tagNil,
		nil,
		nil,
	},
	"q": {
		[]FuncType{TypeString, TypeString},
		TypeSeriesSet,
		tagNil,
		nil,
		nil,
	},
	"forecastlr": {
		[]FuncType{TypeSeriesSet, TypeScalar},
		TypeNumberSet,
		tagNil,
		nil,
		nil,
	},
}
