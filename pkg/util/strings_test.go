package util

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestStringsFallback2(t *testing.T) {
	tests := []struct {
		val1     string
		val2     string
		expected string
	}{
		// testing every scenario
		{"", "", ""},
		{"1", "", "1"},
		{"1", "2", "1"},
		{"", "2", "2"},
	}
	for _, testcase := range tests {
		assert.EqualValues(t, testcase.expected, StringsFallback2(testcase.val1, testcase.val2))
	}
}

func TestStringsFallback3(t *testing.T) {
	tests := []struct {
		val1     string
		val2     string
		val3     string
		expected string
	}{
		{"", "", "", ""},
		{"1", "", "", "1"},
		{"1", "2", "", "1"},
		{"1", "2", "3", "1"},
		{"", "2", "", "2"},
		{"", "2", "3", "2"},
		{"", "", "3", "3"},
	}
	for _, testcase := range tests {
		assert.EqualValues(t, testcase.expected, StringsFallback3(testcase.val1, testcase.val2, testcase.val3))
	}
}

func TestSplitString(t *testing.T) {
	tests := map[string][]string{
		"":                       {},
		"test":                   {"test"},
		"  test1 test2 test3":    {"test1", "test2", "test3"},
		"test1,test2,test3":      {"test1", "test2", "test3"},
		"test1, test2, test3":    {"test1", "test2", "test3"},
		"test1 , test2 test3":    {"test1", "test2", "test3"},
		"foo, bar baz":           {"foo", "bar", "baz"},
		`["foo", "bar baz"]`:     {"foo", "bar baz"},
		`["foo", "bar \"baz\""]`: {"foo", "bar \"baz\""},
		` ["foo", "bar baz"]`:    {"foo", "bar baz"},
		`[]`:                     {},
	}
	for input, expected := range tests {
		assert.EqualValues(t, expected, SplitString(input))
	}
}

func BenchmarkSplitString(b *testing.B) {
	b.Run("empty input", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			SplitString("")
		}
	})
	b.Run("single string", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			SplitString("test")
		}
	})
	b.Run("space-separated", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			SplitString("test1 test2 test3")
		}
	})
	b.Run("comma-separated", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			SplitString("test1,test2,test3")
		}
	})
	b.Run("comma-separated with spaces", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			SplitString("test1 , test2 test3")
		}
	})
	b.Run("mixed commas and spaces", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			SplitString("test1 , test2 test3,test4")
		}
	})
	b.Run("very long mixed", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			SplitString("test1 , test2 test3,test4, test5 test6 test7,test8 test9 test10" +
				" test11 test12 test13,test14 test15 test16,test17 test18 test19,test20 test21 test22" +
				" test23,test24 test25 test26,test27 test28 test29,test30 test31 test32" +
				" test33,test34 test35 test36,test37 test38 test39,test40 test41 test42" +
				" test43,test44 test45 test46,test47 test48 test49,test50 test51 test52" +
				" test53,test54 test55 test56,test57 test58 test59,test60 test61 test62" +
				" test63,test64 test65 test66,test67 test68 test69,test70 test71 test72" +
				" test73,test74 test75 test76,test77 test78 test79,test80 test81 test82" +
				" test83,test84 test85 test86,test87 test88 test89,test90 test91 test92" +
				" test93,test94 test95 test96,test97 test98 test99,test100 ")
		}
	})
}

func TestDateAge(t *testing.T) {
	assert.Equal(t, "?", GetAgeString(time.Time{})) // base case

	tests := map[time.Duration]string{
		-1 * time.Hour:       "< 1 minute", // one hour in the future
		0:                    "< 1 minute",
		2 * time.Second:      "< 1 minute",
		2 * time.Minute:      "2 minutes",
		2 * time.Hour:        "2 hours",
		3 * 24 * time.Hour:   "3 days",
		67 * 24 * time.Hour:  "2 months",
		409 * 24 * time.Hour: "1 year",
	}
	for elapsed, expected := range tests {
		assert.Equalf(
			t,
			expected,
			GetAgeString(time.Now().Add(-elapsed)),
			"duration '%s'",
			elapsed.String(),
		)
	}
}

func TestToCamelCase(t *testing.T) {
	tests := map[string]string{
		"kebab-case-string": "kebabCaseString",
		"snake_case_string": "snakeCaseString",
		"mixed-case_string": "mixedCaseString",
		"alreadyCamelCase":  "alreadyCamelCase",
		"":                  "",
	}
	for input, expected := range tests {
		assert.Equal(t, expected, ToCamelCase(input))
	}
}

func TestCapitalize(t *testing.T) {
	tests := map[string]string{
		"properly capitalizes": "Properly capitalizes",
		"Already capitalized":  "Already capitalized",
		"":                     "",
	}
	for input, expected := range tests {
		assert.Equal(t, expected, Capitalize(input))
	}
}
