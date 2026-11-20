package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseIPOrCIDR(t *testing.T) {
	valid := map[string]string{
		"10.0.0.1":            "10.0.0.1/32",
		"10.1.2.3/8":          "10.0.0.0/8",
		"[::1]":               "::1/128",
		"::ffff:10.0.0.0/104": "10.0.0.0/8",
		"::ffff:10.0.0.1":     "10.0.0.1/32",
	}
	for input, want := range valid {
		t.Run("valid "+input, func(t *testing.T) {
			prefix, err := ParseIPOrCIDR(input)
			require.NoError(t, err)
			assert.Equal(t, want, prefix.String())
		})
	}

	invalid := []string{
		"",
		"10.0.0.0/33",
		"fe80::1%eth0",
		"::ffff:0.0.0.0/80",
		"relay.example.com",
		"[10.0.0.1",
		"10.0.0.1]",
	}
	for _, input := range invalid {
		t.Run("invalid "+input, func(t *testing.T) {
			_, err := ParseIPOrCIDR(input)
			assert.Error(t, err)
		})
	}
}

func TestSplitHostPortDefault_Valid(t *testing.T) {
	tests := []struct {
		input       string
		defaultHost string
		defaultPort string

		host string
		port string
	}{
		{input: "192.168.0.140:456", defaultHost: "", defaultPort: "", host: "192.168.0.140", port: "456"},
		{input: "192.168.0.140", defaultHost: "", defaultPort: "123", host: "192.168.0.140", port: "123"},
		{input: "[::1]:456", defaultHost: "", defaultPort: "", host: "::1", port: "456"},
		{input: "[::1]", defaultHost: "", defaultPort: "123", host: "::1", port: "123"},
		{input: ":456", defaultHost: "1.2.3.4", defaultPort: "", host: "1.2.3.4", port: "456"},
		{input: "xyz.rds.amazonaws.com", defaultHost: "", defaultPort: "123", host: "xyz.rds.amazonaws.com", port: "123"},
		{input: "xyz.rds.amazonaws.com:123", defaultHost: "", defaultPort: "", host: "xyz.rds.amazonaws.com", port: "123"},
		{input: "", defaultHost: "localhost", defaultPort: "1433", host: "localhost", port: "1433"},
	}

	for _, testcase := range tests {
		addr, err := SplitHostPortDefault(testcase.input, testcase.defaultHost, testcase.defaultPort)
		assert.NoError(t, err)
		assert.Equal(t, testcase.host, addr.Host)
		assert.Equal(t, testcase.port, addr.Port)
	}
}
