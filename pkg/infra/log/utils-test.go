package log

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

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
		`"foo", "bar", "baz"`:    {"foo", "bar", "baz"},
		`"foo" "bar" "baz"`:      {"foo", "bar", "baz"},
		` "foo" "bar" "baz"  `:   {"foo", "bar", "baz"},
		`"foo", "bar baz"`:       {"foo", "bar baz"},
		`"foo", bar "baz"`:       {"foo", "bar", "baz"},
		`"first string", "second string", "third string"`:               {"first string", "second string", "third string"},
		`"first string" "second string" "third string" "fourth string"`: {"first string", "second string", "third string", "fourth string"},
		`[]`: {},
	}
	for input, expected := range tests {
		assert.EqualValues(t, expected, SplitString(input))
	}
}
