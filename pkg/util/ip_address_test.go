package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

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
