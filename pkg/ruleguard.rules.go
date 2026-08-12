//go:build ignore
// +build ignore

// The MIT License (MIT)
//
// Copyright (c) 2020 Grafana Labs <contact@grafana.com>, Damian Gryski <damian@gryski.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

package gorules

import "github.com/quasilyte/go-ruleguard/dsl/fluent"

// This is a collection of rules for ruleguard: https://github.com/quasilyte/go-ruleguard
// Copied from https://github.com/dgryski/semgrep-go

// Remove extra conversions: mdempsky/unconvert
func unconvert(m fluent.Matcher) {
	m.Match("int($x)").Where(m["x"].Type.Is("int") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")

	m.Match("float32($x)").Where(m["x"].Type.Is("float32") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")
	m.Match("float64($x)").Where(m["x"].Type.Is("float64") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")

	m.Match("byte($x)").Where(m["x"].Type.Is("byte")).Report("unnecessary conversion").Suggest("$x")
	m.Match("rune($x)").Where(m["x"].Type.Is("rune")).Report("unnecessary conversion").Suggest("$x")
	m.Match("bool($x)").Where(m["x"].Type.Is("bool") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")

	m.Match("int8($x)").Where(m["x"].Type.Is("int8") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")
	m.Match("int16($x)").Where(m["x"].Type.Is("int16") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")
	m.Match("int32($x)").Where(m["x"].Type.Is("int32") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")
	m.Match("int64($x)").Where(m["x"].Type.Is("int64") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")

	m.Match("uint8($x)").Where(m["x"].Type.Is("uint8") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")
	m.Match("uint16($x)").Where(m["x"].Type.Is("uint16") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")
	m.Match("uint32($x)").Where(m["x"].Type.Is("uint32") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")
	m.Match("uint64($x)").Where(m["x"].Type.Is("uint64") && !m["x"].Const).Report("unnecessary conversion").Suggest("$x")

	m.Match("time.Duration($x)").Where(m["x"].Type.Is("time.Duration") && !m["x"].Text.Matches("^[0-9]*$")).Report("unnecessary conversion").Suggest("$x")
}

// Don't use == or != with time.Time
// https://github.com/dominikh/go-tools/issues/47 : Wontfix
func timeeq(m fluent.Matcher) {
	m.Match("$t0 == $t1").Where(m["t0"].Type.Is("time.Time")).Report("using == with time.Time")
	m.Match("$t0 != $t1").Where(m["t0"].Type.Is("time.Time")).Report("using != with time.Time")
	m.Match(`map[$k]$v`).Where(m["k"].Type.Is("time.Time")).Report("map with time.Time keys are easy to misuse")
}

// Wrong err in error check
func wrongerr(m fluent.Matcher) {
	m.Match("if $*_, $err0 := $*_; $err1 != nil { $*_ }").
		Where(m["err0"].Text == "err" && m["err0"].Type.Is("error") && m["err1"].Text != "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("if $*_, $err0 := $*_; $err1 != nil { $*_ }").
		Where(m["err0"].Text != "err" && m["err0"].Type.Is("error") && m["err1"].Text == "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("if $*_, $err0 = $*_; $err1 != nil { $*_ }").
		Where(m["err0"].Text == "err" && m["err0"].Type.Is("error") && m["err1"].Text != "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("if $*_, $err0 = $*_; $err1 != nil { $*_ }").
		Where(m["err0"].Text != "err" && m["err0"].Type.Is("error") && m["err1"].Text == "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("if $*_, $err0 := $*_; $err1 == nil { $*_ }").
		Where(m["err0"].Text == "err" && m["err0"].Type.Is("error") && m["err1"].Text != "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("if $*_, $err0 := $*_; $err1 == nil { $*_ }").
		Where(m["err0"].Text != "err" && m["err0"].Type.Is("error") && m["err1"].Text == "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("if $*_, $err0 = $*_; $err1 == nil { $*_ }").
		Where(m["err0"].Text == "err" && m["err0"].Type.Is("error") && m["err1"].Text != "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("if $*_, $err0 = $*_; $err1 == nil { $*_ }").
		Where(m["err0"].Text != "err" && m["err0"].Type.Is("error") && m["err1"].Text == "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("$*_, $err0 := $*_; if $err1 != nil { $*_ }").
		Where(m["err0"].Text == "err" && m["err0"].Type.Is("error") && m["err1"].Text != "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("$*_, $err0 := $*_; if $err1 != nil { $*_ }").
		Where(m["err0"].Text != "err" && m["err0"].Type.Is("error") && m["err1"].Text == "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("$*_, $err0 := $*_; if $err1 == nil { $*_ }").
		Where(m["err0"].Text == "err" && m["err0"].Type.Is("error") && m["err1"].Text != "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("$*_, $err0 := $*_; if $err1 == nil { $*_ }").
		Where(m["err0"].Text != "err" && m["err0"].Type.Is("error") && m["err1"].Text == "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("$*_, $err0 = $*_; if $err1 != nil { $*_ }").
		Where(m["err0"].Text == "err" && m["err0"].Type.Is("error") && m["err1"].Text != "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("$*_, $err0 = $*_; if $err1 != nil { $*_ }").
		Where(m["err0"].Text != "err" && m["err0"].Type.Is("error") && m["err1"].Text == "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("$*_, $err0 = $*_; if $err1 == nil { $*_ }").
		Where(m["err0"].Text == "err" && m["err0"].Type.Is("error") && m["err1"].Text != "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")

	m.Match("$*_, $err0 = $*_; if $err1 == nil { $*_ }").
		Where(m["err0"].Text != "err" && m["err0"].Type.Is("error") && m["err1"].Text == "err" && m["err1"].Type.Is("error")).
		Report("maybe wrong err in error check")
}

// err but no an error
func errnoterror(m fluent.Matcher) {

	// Would be easier to check for all err identifiers instead, but then how do we get the type from m[] ?

	m.Match(
		"if $*_, err := $x; $err != nil { $*_ } else if $_ { $*_ }",
		"if $*_, err := $x; $err != nil { $*_ } else { $*_ }",
		"if $*_, err := $x; $err != nil { $*_ }",

		"if $*_, err = $x; $err != nil { $*_ } else if $_ { $*_ }",
		"if $*_, err = $x; $err != nil { $*_ } else { $*_ }",
		"if $*_, err = $x; $err != nil { $*_ }",

		"$*_, err := $x; if $err != nil { $*_ } else if $_ { $*_ }",
		"$*_, err := $x; if $err != nil { $*_ } else { $*_ }",
		"$*_, err := $x; if $err != nil { $*_ }",

		"$*_, err = $x; if $err != nil { $*_ } else if $_ { $*_ }",
		"$*_, err = $x; if $err != nil { $*_ } else { $*_ }",
		"$*_, err = $x; if $err != nil { $*_ }",
	).
		Where(m["err"].Text == "err" && !m["err"].Type.Is("error") && m["x"].Text != "recover()").
		Report("err variable not error type")
}

// Identical if and else bodies
func ifbodythenbody(m fluent.Matcher) {
	m.Match("if $*_ { $body } else { $body }").
		Report("identical if and else bodies")

	// Lots of false positives.
	// m.Match("if $*_ { $body } else if $*_ { $body }").
	//	Report("identical if and else bodies")
}

// Odd inequality: A - B < 0 instead of !=
// Too many false positives.
/*
func subtractnoteq(m fluent.Matcher) {
	m.Match("$a - $b < 0").Report("consider $a != $b")
	m.Match("$a - $b > 0").Report("consider $a != $b")
	m.Match("0 < $a - $b").Report("consider $a != $b")
	m.Match("0 > $a - $b").Report("consider $a != $b")
}
*/

// Self-assignment
func selfassign(m fluent.Matcher) {
	m.Match("$x = $x").Report("useless self-assignment")
}

// Odd nested ifs
func oddnestedif(m fluent.Matcher) {
	m.Match("if $x { if $x { $*_ }; $*_ }",
		"if $x == $y { if $x != $y {$*_ }; $*_ }",
		"if $x != $y { if $x == $y {$*_ }; $*_ }",
		"if $x { if !$x { $*_ }; $*_ }",
		"if !$x { if $x { $*_ }; $*_ }").
		Report("odd nested ifs")

	m.Match("for $x { if $x { $*_ }; $*_ }",
		"for $x == $y { if $x != $y {$*_ }; $*_ }",
		"for $x != $y { if $x == $y {$*_ }; $*_ }",
		"for $x { if !$x { $*_ }; $*_ }",
		"for !$x { if $x { $*_ }; $*_ }").
		Report("odd nested for/ifs")
}

// odd bitwise expressions
func oddbitwise(m fluent.Matcher) {
	m.Match("$x | $x",
		"$x | ^$x",
		"^$x | $x").
		Report("odd bitwise OR")

	m.Match("$x & $x",
		"$x & ^$x",
		"^$x & $x").
		Report("odd bitwise AND")

	m.Match("$x &^ $x").
		Report("odd bitwise AND-NOT")
}

// odd sequence of if tests with return
func ifreturn(m fluent.Matcher) {
	m.Match("if $x { return $*_ }; if $x {$*_ }").Report("odd sequence of if test")
	m.Match("if $x { return $*_ }; if !$x {$*_ }").Report("odd sequence of if test")
	m.Match("if !$x { return $*_ }; if $x {$*_ }").Report("odd sequence of if test")
	m.Match("if $x == $y { return $*_ }; if $x != $y {$*_ }").Report("odd sequence of if test")
	m.Match("if $x != $y { return $*_ }; if $x == $y {$*_ }").Report("odd sequence of if test")

}

func oddifsequence(m fluent.Matcher) {
	m.Match("if $x { $*_ }; if $x {$*_ }").Report("odd sequence of if test")

	m.Match("if $x == $y { $*_ }; if $y == $x {$*_ }").Report("odd sequence of if tests")
	m.Match("if $x != $y { $*_ }; if $y != $x {$*_ }").Report("odd sequence of if tests")

	m.Match("if $x < $y { $*_ }; if $y > $x {$*_ }").Report("odd sequence of if tests")
	m.Match("if $x <= $y { $*_ }; if $y >= $x {$*_ }").Report("odd sequence of if tests")

	m.Match("if $x > $y { $*_ }; if $y < $x {$*_ }").Report("odd sequence of if tests")
	m.Match("if $x >= $y { $*_ }; if $y <= $x {$*_ }").Report("odd sequence of if tests")
}

// odd sequence of nested if tests
func nestedifsequence(m fluent.Matcher) {
	m.Match("if $x < $y { if $x >= $y {$*_ }; $*_ }").Report("odd sequence of nested if tests")
	m.Match("if $x <= $y { if $x > $y {$*_ }; $*_ }").Report("odd sequence of nested if tests")
	m.Match("if $x > $y { if $x <= $y {$*_ }; $*_ }").Report("odd sequence of nested if tests")
	m.Match("if $x >= $y { if $x < $y {$*_ }; $*_ }").Report("odd sequence of nested if tests")
}

// odd sequence of assignments
func identicalassignments(m fluent.Matcher) {
	m.Match("$x  = $y; $y = $x").Report("odd sequence of assignments")
}

func oddcompoundop(m fluent.Matcher) {
	m.Match("$x += $x + $_",
		"$x += $x - $_").
		Report("odd += expression")

	m.Match("$x -= $x + $_",
		"$x -= $x - $_").
		Report("odd -= expression")
}

func constswitch(m fluent.Matcher) {
	m.Match("switch $x { $*_ }", "switch $*_; $x { $*_ }").
		Where(m["x"].Const && !m["x"].Text.Matches(`^runtime\.`)).
		Report("constant switch")
}

func oddcomparisons(m fluent.Matcher) {
	m.Match(
		"$x - $y == 0",
		"$x - $y != 0",
		"$x - $y < 0",
		"$x - $y <= 0",
		"$x - $y > 0",
		"$x - $y >= 0",
		"$x ^ $y == 0",
		"$x ^ $y != 0",
	).Report("odd comparison")
}

func oddmathbits(m fluent.Matcher) {
	m.Match(
		"64 - bits.LeadingZeros64($x)",
		"32 - bits.LeadingZeros32($x)",
		"16 - bits.LeadingZeros16($x)",
		"8 - bits.LeadingZeros8($x)",
	).Report("odd math/bits expression: use bits.Len*() instead?")
}

/*
func floateq(m fluent.Matcher) {
	m.Match(
		"$x == $y",
		"$x != $y",
	).
		Where(m["x"].Type.Is("float32") && !m["x"].Const && !m["y"].Text.Matches("0(.0+)?")).
		Report("floating point tested for equality")

	m.Match(
		"$x == $y",
		"$x != $y",
	).
		Where(m["x"].Type.Is("float64") && !m["x"].Const && !m["y"].Text.Matches("0(.0+)?")).
		Report("floating point tested for equality")

	m.Match("switch $x { $*_ }", "switch $*_; $x { $*_ }").
		Where(m["x"].Type.Is("float32")).
		Report("floating point as switch expression")

	m.Match("switch $x { $*_ }", "switch $*_; $x { $*_ }").
		Where(m["x"].Type.Is("float64")).
		Report("floating point as switch expression")
}
*/

func badexponent(m fluent.Matcher) {
	m.Match(
		"2 ^ $x",
		"10 ^ $x",
	).
		Report("caret (^) is not exponentiation")
}

/*
func floatloop(m fluent.Matcher) {
	m.Match(
		"for $i := $x; $i < $y; $i += $z { $*_ }",
		"for $i = $x; $i < $y; $i += $z { $*_ }",
	).
		Where(m["i"].Type.Is("float64")).
		Report("floating point for loop counter")

	m.Match(
		"for $i := $x; $i < $y; $i += $z { $*_ }",
		"for $i = $x; $i < $y; $i += $z { $*_ }",
	).
		Where(m["i"].Type.Is("float32")).
		Report("floating point for loop counter")
}
*/

func urlredacted(m fluent.Matcher) {

	m.Match(
		"log.Println($x, $*_)",
		"log.Println($*_, $x, $*_)",
		"log.Println($*_, $x)",
		"log.Printf($*_, $x, $*_)",
		"log.Printf($*_, $x)",

		"log.Println($x, $*_)",
		"log.Println($*_, $x, $*_)",
		"log.Println($*_, $x)",
		"log.Printf($*_, $x, $*_)",
		"log.Printf($*_, $x)",
	).
		Where(m["x"].Type.Is("*url.URL")).
		Report("consider $x.Redacted() when outputting URLs")
}

func sprinterr(m fluent.Matcher) {
	m.Match(`fmt.Sprint($err)`,
		`fmt.Sprintf("%s", $err)`,
		`fmt.Sprintf("%v", $err)`,
	).
		Where(m["err"].Type.Is("error")).
		Report("maybe call $err.Error() instead of fmt.Sprint()?")

}

func largeloopcopy(m fluent.Matcher) {
	m.Match(
		`for $_, $v := range $_ { $*_ }`,
	).
		Where(m["v"].Type.Size > 512).
		Report(`loop copies large value each iteration`)
}

func joinpath(m fluent.Matcher) {
	m.Match(
		`strings.Join($_, "/")`,
		`strings.Join($_, "\\")`,
		"strings.Join($_, `\\`)",
	).
		Report(`did you mean path.Join() or filepath.Join() ?`)
}

func readfull(m fluent.Matcher) {
	m.Match(`$n, $err := io.ReadFull($_, $slice)
                 if $err != nil || $n != len($slice) {
                              $*_
		 }`,
		`$n, $err := io.ReadFull($_, $slice)
                 if $n != len($slice) || $err != nil {
                              $*_
		 }`,
		`$n, $err = io.ReadFull($_, $slice)
                 if $err != nil || $n != len($slice) {
                              $*_
		 }`,
		`$n, $err = io.ReadFull($_, $slice)
                 if $n != len($slice) || $err != nil {
                              $*_
		 }`,
		`if $n, $err := io.ReadFull($_, $slice); $n != len($slice) || $err != nil {
                              $*_
		 }`,
		`if $n, $err := io.ReadFull($_, $slice); $err != nil || $n != len($slice) {
                              $*_
		 }`,
		`if $n, $err = io.ReadFull($_, $slice); $n != len($slice) || $err != nil {
                              $*_
		 }`,
		`if $n, $err = io.ReadFull($_, $slice); $err != nil || $n != len($slice) {
                              $*_
		 }`,
	).Report("io.ReadFull() returns err == nil iff n == len(slice)")
}

func nilerr(m fluent.Matcher) {
	m.Match(
		`if err == nil { return err }`,
		`if err == nil { return $*_, err }`,
	).
		Report(`return nil error instead of nil value`)

}

func mailaddress(m fluent.Matcher) {
	m.Match(
		"fmt.Sprintf(`\"%s\" <%s>`, $NAME, $EMAIL)",
		"fmt.Sprintf(`\"%s\"<%s>`, $NAME, $EMAIL)",
		"fmt.Sprintf(`%s <%s>`, $NAME, $EMAIL)",
		"fmt.Sprintf(`%s<%s>`, $NAME, $EMAIL)",
		`fmt.Sprintf("\"%s\"<%s>", $NAME, $EMAIL)`,
		`fmt.Sprintf("\"%s\" <%s>", $NAME, $EMAIL)`,
		`fmt.Sprintf("%s<%s>", $NAME, $EMAIL)`,
		`fmt.Sprintf("%s <%s>", $NAME, $EMAIL)`,
	).
		Report("use net/mail Address.String() instead of fmt.Sprintf()").
		Suggest("(&mail.Address{Name:$NAME, Address:$EMAIL}).String()")
}

func errnetclosed(m fluent.Matcher) {
	m.Match(
		`strings.Contains($err.Error(), $text)`,
	).
		Where(m["text"].Text.Matches("\".*closed network connection.*\"")).
		Report(`String matching against error texts is fragile; use net.ErrClosed instead`).
		Suggest(`errors.Is($err, net.ErrClosed)`)

}

func httpheaderadd(m fluent.Matcher) {
	m.Match(
		`$H.Add($KEY, $VALUE)`,
	).
		Where(m["H"].Type.Is("http.Header")).
		Report("use http.Header.Set method instead of Add to overwrite all existing header values").
		Suggest(`$H.Set($KEY, $VALUE)`)
}

func hmacnew(m fluent.Matcher) {
	m.Match("hmac.New(func() hash.Hash { return $x }, $_)",
		`$f := func() hash.Hash { return $x }
	$*_
	hmac.New($f, $_)`,
	).Where(m["x"].Pure).
		Report("invalid hash passed to hmac.New()")
}

func readeof(m fluent.Matcher) {
	m.Match(
		`$n, $err = $r.Read($_)
	if $err != nil {
	    return $*_
	}`,
		`$n, $err := $r.Read($_)
	if $err != nil {
	    return $*_
	}`).Where(m["r"].Type.Implements("io.Reader")).
		Report("Read() can return n bytes and io.EOF")
}

func writestring(m fluent.Matcher) {
	m.Match(`io.WriteString($w, string($b))`).
		Where(m["b"].Type.Is("[]byte")).
		Suggest("$w.Write($b)")
}

func badlock(m fluent.Matcher) {
	// Shouldn't give many false positives without type filter
	// as Lock+Unlock pairs in combination with defer gives us pretty
	// a good chance to guess correctly. If we constrain the type to sync.Mutex
	// then it'll be harder to match embedded locks and custom methods
	// that may forward the call to the sync.Mutex (or other synchronization primitive).

	m.Match(`$mu.Lock(); defer $mu.RUnlock()`).Report(`maybe $mu.RLock() was intended?`)
	m.Match(`$mu.RLock(); defer $mu.Unlock()`).Report(`maybe $mu.Lock() was intended?`)
}
