package envvars

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPermittedHostEnvVars_respectsPLUGIN_UNIX_SOCKET_DIR(t *testing.T) {
	customTmp := t.TempDir()
	t.Setenv("PLUGIN_UNIX_SOCKET_DIR", customTmp)

	vars := PermittedHostEnvVars()

	var count int
	for _, v := range vars {
		if strings.HasPrefix(v, "PLUGIN_UNIX_SOCKET_DIR=") {
			require.Equal(t, "PLUGIN_UNIX_SOCKET_DIR="+customTmp, v, "PLUGIN_UNIX_SOCKET_DIR should be forwarded when set")
			count++
		}
	}
	require.Equal(t, 1, count, "PLUGIN_UNIX_SOCKET_DIR should appear exactly once in PermittedHostEnvVars when set")
}

func TestPermittedHostEnvVarNames_includesPLUGIN_UNIX_SOCKET_DIR(t *testing.T) {
	names := PermittedHostEnvVarNames()
	require.Contains(t, names, "PLUGIN_UNIX_SOCKET_DIR", "PLUGIN_UNIX_SOCKET_DIR must be in permitted host env var names for restricted environments")
}

func TestPermittedHostEnvVars_PLUGIN_UNIX_SOCKET_DIR_Unset(t *testing.T) {
	if prev, hadTMPDIR := os.LookupEnv("PLUGIN_UNIX_SOCKET_DIR"); hadTMPDIR {
		t.Cleanup(func() { _ = os.Setenv("PLUGIN_UNIX_SOCKET_DIR", prev) })
	} else {
		t.Cleanup(func() { _ = os.Unsetenv("PLUGIN_UNIX_SOCKET_DIR") })
	}
	_ = os.Unsetenv("PLUGIN_UNIX_SOCKET_DIR")

	vars := PermittedHostEnvVars()

	for _, v := range vars {
		if strings.HasPrefix(v, "PLUGIN_UNIX_SOCKET_DIR=") {
			t.Fatal("PLUGIN_UNIX_SOCKET_DIR should not be present when unset")
		}
	}
}

func TestPermittedHostEnvVarNames_includesSSLCertEnvVars(t *testing.T) {
	names := PermittedHostEnvVarNames()
	require.Contains(t, names, "SSL_CERT_FILE", "SSL_CERT_FILE must be in permitted host env var names for custom CA certificate file")
	require.Contains(t, names, "SSL_CERT_DIR", "SSL_CERT_DIR must be in permitted host env var names for custom CA certificate directory")
}

func TestPermittedHostEnvVars_respectsSSLCertEnvVars(t *testing.T) {
	tempDir := t.TempDir()
	certFile := tempDir + "/custom-ca.pem"
	certDir := tempDir + "/certs"

	t.Setenv("SSL_CERT_FILE", certFile)
	t.Setenv("SSL_CERT_DIR", certDir)

	vars := PermittedHostEnvVars()

	require.Contains(t, vars, "SSL_CERT_FILE="+certFile, "SSL_CERT_FILE should be forwarded when set")
	require.Contains(t, vars, "SSL_CERT_DIR="+certDir, "SSL_CERT_DIR should be forwarded when set")
}

func TestPermittedHostEnvVars_SSLCertEnvVars_Unset(t *testing.T) {
	if prevFile, hadFile := os.LookupEnv("SSL_CERT_FILE"); hadFile {
		t.Cleanup(func() { _ = os.Setenv("SSL_CERT_FILE", prevFile) })
	} else {
		t.Cleanup(func() { _ = os.Unsetenv("SSL_CERT_FILE") })
	}
	_ = os.Unsetenv("SSL_CERT_FILE")

	if prevDir, hadDir := os.LookupEnv("SSL_CERT_DIR"); hadDir {
		t.Cleanup(func() { _ = os.Setenv("SSL_CERT_DIR", prevDir) })
	} else {
		t.Cleanup(func() { _ = os.Unsetenv("SSL_CERT_DIR") })
	}
	_ = os.Unsetenv("SSL_CERT_DIR")

	vars := PermittedHostEnvVars()

	for _, v := range vars {
		if strings.HasPrefix(v, "SSL_CERT_FILE=") {
			t.Fatal("SSL_CERT_FILE should not be present when unset")
		}
		if strings.HasPrefix(v, "SSL_CERT_DIR=") {
			t.Fatal("SSL_CERT_DIR should not be present when unset")
		}
	}
}
