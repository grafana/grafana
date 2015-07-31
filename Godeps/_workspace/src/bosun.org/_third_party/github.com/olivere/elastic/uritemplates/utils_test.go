package uritemplates

import (
	"testing"
)

type ExpandTest struct {
	in         string
	expansions map[string]string
	want       string
}

var expandTests = []ExpandTest{
	// #0: no expansions
	{
		"http://www.golang.org/",
		map[string]string{},
		"http://www.golang.org/",
	},
	// #1: one expansion, no escaping
	{
		"http://www.golang.org/{bucket}/delete",
		map[string]string{
			"bucket": "red",
		},
		"http://www.golang.org/red/delete",
	},
	// #2: one expansion, with hex escapes
	{
		"http://www.golang.org/{bucket}/delete",
		map[string]string{
			"bucket": "red/blue",
		},
		"http://www.golang.org/red%2Fblue/delete",
	},
	// #3: one expansion, with space
	{
		"http://www.golang.org/{bucket}/delete",
		map[string]string{
			"bucket": "red or blue",
		},
		"http://www.golang.org/red%20or%20blue/delete",
	},
	// #4: expansion not found
	{
		"http://www.golang.org/{object}/delete",
		map[string]string{
			"bucket": "red or blue",
		},
		"http://www.golang.org//delete",
	},
	// #5: multiple expansions
	{
		"http://www.golang.org/{one}/{two}/{three}/get",
		map[string]string{
			"one":   "ONE",
			"two":   "TWO",
			"three": "THREE",
		},
		"http://www.golang.org/ONE/TWO/THREE/get",
	},
	// #6: utf-8 characters
	{
		"http://www.golang.org/{bucket}/get",
		map[string]string{
			"bucket": "£100",
		},
		"http://www.golang.org/%C2%A3100/get",
	},
	// #7: punctuations
	{
		"http://www.golang.org/{bucket}/get",
		map[string]string{
			"bucket": `/\@:,.*~`,
		},
		"http://www.golang.org/%2F%5C%40%3A%2C.%2A~/get",
	},
	// #8: mis-matched brackets
	{
		"http://www.golang.org/{bucket/get",
		map[string]string{
			"bucket": "red",
		},
		"",
	},
	// #9: "+" prefix for suppressing escape
	// See also: http://tools.ietf.org/html/rfc6570#section-3.2.3
	{
		"http://www.golang.org/{+topic}",
		map[string]string{
			"topic": "/topics/myproject/mytopic",
		},
		// The double slashes here look weird, but it's intentional
		"http://www.golang.org//topics/myproject/mytopic",
	},
}

func TestExpand(t *testing.T) {
	for i, test := range expandTests {
		got, _ := Expand(test.in, test.expansions)
		if got != test.want {
			t.Errorf("got %q expected %q in test %d", got, test.want, i)
		}
	}
}
