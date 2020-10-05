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
		"":                    {},
		"test":                {"test"},
		"test1 test2 test3":   {"test1", "test2", "test3"},
		"test1,test2,test3":   {"test1", "test2", "test3"},
		"test1, test2, test3": {"test1", "test2", "test3"},
		"test1 , test2 test3": {"test1", "test2", "test3"},
	}
	for input, expected := range tests {
		assert.EqualValues(t, expected, SplitString(input))
	}
}

func TestDateAge(t *testing.T) {
	assert.Equal(t, "?", GetAgeString(time.Time{})) // base case

	tests := map[time.Duration]string{
		-1 * time.Hour:       "< 1m", // one hour in the future
		0:                    "< 1m",
		2 * time.Second:      "< 1m",
		2 * time.Minute:      "2m",
		2 * time.Hour:        "2h",
		3 * 24 * time.Hour:   "3d",
		67 * 24 * time.Hour:  "2M",
		409 * 24 * time.Hour: "1y",
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
	}
	for input, expected := range tests {
		assert.Equal(t, expected, ToCamelCase(input))
	}
}
