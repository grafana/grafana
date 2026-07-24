package util

import (
	"crypto/tls"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTlsNameToVersion(t *testing.T) {
	tests := []struct {
		tlsVer   string
		expected uint16
	}{
		{"TLS1.0", tls.VersionTLS10},
		{"TLS1.1", tls.VersionTLS11},
		{"TLS1.2", tls.VersionTLS12},
		{"TLS1.3", tls.VersionTLS13},
		{"SSSL", 0},
	}

	for _, testcase := range tests {
		verStr, _ := TlsNameToVersion(testcase.tlsVer)
		assert.EqualValues(t, testcase.expected, verStr)
	}
}
