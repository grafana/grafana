package util

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCalculateMacroTimezoneOffset_Valid(t *testing.T) {
	tests := []struct {
		rawTimezoneOffset string
		expected          string
	}{
		{rawTimezoneOffset: "-05:00", expected: "+ 18000"},
		{rawTimezoneOffset: "-04:00", expected: "+ 14400"},
		{rawTimezoneOffset: "+02:00", expected: "- 7200"},
		{rawTimezoneOffset: "+05:20", expected: "- 19200"},
		{rawTimezoneOffset: "-02:30", expected: "+ 9000"},
		{rawTimezoneOffset: "-12:00", expected: "+ 43200"},
		{rawTimezoneOffset: "-00:33", expected: "+ 1980"},
		{rawTimezoneOffset: "-00:00", expected: "+ 0"},
		{rawTimezoneOffset: "+00:00", expected: "- 0"},
	}

	for _, testcase := range tests {
		timezoneOffset, err := CalculateMacroTimezoneOffset(testcase.rawTimezoneOffset)
		assert.NoError(t, err)
		assert.Equal(t, testcase.expected, timezoneOffset)
	}
}

func TestCalculateMacroTimezoneOffset_Error(t *testing.T) {
	tests := []struct {
		rawTimezoneOffset string
	}{
		{rawTimezoneOffset: "UTC"},
		{rawTimezoneOffset: "UTC-04:00"},
		{rawTimezoneOffset: "Europe/London"},
	}

	for _, testcase := range tests {
		_, err := CalculateMacroTimezoneOffset(testcase.rawTimezoneOffset)
		if assert.Error(t, err) {
			assert.Equal(t, fmt.Sprintf("timezone argument error %v", testcase.rawTimezoneOffset), err.Error())
		}
	}
}
