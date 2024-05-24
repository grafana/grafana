package dbimpl

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSplitHostPort(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		hostport    string
		defaultHost string
		defaultPort string

		host string
		port string
	}{
		{hostport: "192.168.0.140:456", defaultHost: "", defaultPort: "", host: "192.168.0.140", port: "456"},
		{hostport: "192.168.0.140", defaultHost: "", defaultPort: "123", host: "192.168.0.140", port: "123"},
		{hostport: "[::1]:456", defaultHost: "", defaultPort: "", host: "::1", port: "456"},
		{hostport: "[::1]", defaultHost: "", defaultPort: "123", host: "::1", port: "123"},
		{hostport: ":456", defaultHost: "1.2.3.4", defaultPort: "", host: "1.2.3.4", port: "456"},
		{hostport: "xyz.rds.amazonaws.com", defaultHost: "", defaultPort: "123", host: "xyz.rds.amazonaws.com", port: "123"},
		{hostport: "xyz.rds.amazonaws.com:123", defaultHost: "", defaultPort: "", host: "xyz.rds.amazonaws.com", port: "123"},
		{hostport: "", defaultHost: "localhost", defaultPort: "1433", host: "localhost", port: "1433"},
	}

	for _, tc := range testCases {
		host, port, err := splitHostPortDefault(tc.hostport, tc.defaultHost, tc.defaultPort)
		assert.NoError(t, err)
		assert.Equal(t, tc.host, host)
		assert.Equal(t, tc.port, port)
	}
}
