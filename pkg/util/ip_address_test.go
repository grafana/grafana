package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseIPAddress_Valid(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{input: "127.0.0.1", expected: "127.0.0.1"},
		{input: "192.168.0.140:456", expected: "192.168.0.140"},
		{input: "192.168.0.140", expected: "192.168.0.140"},
		{input: "[::1]:456", expected: "::1"},
		{input: "[::1]", expected: "::1"},
	}
	for _, testcase := range tests {
		addr, err := ParseIPAddress(testcase.input)
		require.NoError(t, err)
		assert.Equal(t, testcase.expected, addr)
	}
}

func TestParseIPAddress_Invalid(t *testing.T) {
	tests := []struct {
		input string
		err   string
	}{
		{
			input: "[::1",
			err:   "failed to split network address \"[::1\" by host and port: Malformed IPv6 address: '[::1'",
		},
		{
			input: "::1]",
			err:   "failed to split network address \"::1]\" by host and port: net.SplitHostPort failed for '::1]': address ::1]: too many colons in address",
		},
		{
			input: "",
			err:   "failed to split network address \"\" by host and port: Input is empty",
		},
	}
	for _, testcase := range tests {
		addr, err := ParseIPAddress(testcase.input)
		assert.EqualError(t, err, testcase.err)
		assert.Empty(t, addr)
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

func TestSplitHostPort_Valid(t *testing.T) {
	tests := []struct {
		input string
		host  string
		port  string
	}{
		{input: "192.168.0.140:456", host: "192.168.0.140", port: "456"},
		{input: "192.168.0.140", host: "192.168.0.140", port: ""},
		{input: "[::1]:456", host: "::1", port: "456"},
		{input: "[::1]", host: "::1", port: ""},
		{input: ":456", host: "", port: "456"},
		{input: "xyz.rds.amazonaws.com", host: "xyz.rds.amazonaws.com", port: ""},
		{input: "xyz.rds.amazonaws.com:123", host: "xyz.rds.amazonaws.com", port: "123"},
	}
	for _, testcase := range tests {
		addr, err := SplitHostPort(testcase.input)
		require.NoError(t, err)
		assert.Equal(t, testcase.host, addr.Host)
		assert.Equal(t, testcase.port, addr.Port)
	}
}
