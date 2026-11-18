package util

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidHostname(t *testing.T) {
	t.Parallel()

	// RFC 1035 section 2.3.1 syntax, as updated by RFC 1123 section 2.1.
	valid := []string{
		"a",
		"smtpproxy",
		"relay.example.com",
		"host1.example.com",
		"my-host.example.com",
		"a.b.c.d.e",
		"xn--bcher-kva.example",
		// RFC 1123: a label may start with a digit.
		"3com.example",
		"1.example.com",
		"123.example",
		"1a",
		// RFC 1123: labels up to 63 characters, names up to 255 octets on the
		// wire, which is 253 characters in text form.
		strings.Repeat("a", 63) + ".example",
		strings.Repeat(strings.Repeat("a", 63)+".", 3) + strings.Repeat("a", 61),
		// Neither RFC allows underscores, but internal and service names use them.
		"smtp_proxy.internal",
	}
	for _, hostname := range valid {
		assert.True(t, ValidHostname(hostname), "hostname %q", hostname)
	}

	invalid := []string{
		"",
		"a..b",
		"-bad.example",
		"bad-.example",
		"http://metadata",
		strings.Repeat("a", 64) + ".example",
		strings.Repeat("a.", 127) + "a",
		// RFC 1123: the top-level label is never all-numeric, so these are
		// malformed IPv4 addresses, not hostnames.
		"010.0.0.1",
		"10.0.0.256",
		"1",
		"example.123",
	}
	for _, hostname := range invalid {
		assert.False(t, ValidHostname(hostname), "hostname %q", hostname)
	}
}

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
