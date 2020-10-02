package util

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsEmail(t *testing.T) {
	t.Parallel()

	emails := map[string]struct {
		description string
		valid       bool
	}{
		"":                         {description: "the empty string", valid: false},
		"@.":                       {description: "at dot", valid: false},
		"me@":                      {description: "no domain", valid: false},
		"abcdef.com":               {description: "only a domain name", valid: false},
		"@example.org":             {description: "no recipient", valid: false},
		"please\x0Ano@example.org": {description: "new line", valid: false},

		"abc@def.com":                 {description: "a simple valid email", valid: true},
		"grapher+grafana@example.org": {description: "a gmail style alias", valid: true},
		"öhnej@example.se":            {description: "non-ASCII characters", valid: true},
	}
	for input, testcase := range emails {
		validity := "invalid"
		if testcase.valid {
			validity = "valid"
		}

		t.Run(fmt.Sprintf("validating that %s is %s", testcase.description, validity), func(t *testing.T) {
			assert.Equal(t, testcase.valid, IsEmail(input))
		})
	}
}
