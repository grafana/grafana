package util

import (
	"crypto/tls"
	"fmt"
	"strings"
)

// tlsNameToVersion converts a string to a tls version
func TlsNameToVersion(name string) (uint16, error) {
	name = strings.ToUpper(name)
	switch name {
	case "TLS1.0":
		return tls.VersionTLS10, nil
	case "TLS1.1":
		return tls.VersionTLS11, nil
	case "TLS1.2":
		return tls.VersionTLS12, nil
	case "TLS1.3":
		return tls.VersionTLS13, nil
	}

	return 0, fmt.Errorf("unknown tls version: %q", name)
}

// Cipher strings https://go.dev/src/crypto/tls/cipher_suites.go
// Ex: "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256" or "TLS_RSA_WITH_AES_128_CBC_SHA"
func TlsCiphersToIDs(names []string) ([]uint16, error) {
	if len(names) == 0 || names == nil {
		// no ciphers specified, use defaults
		return nil, nil
	}
	var ids []uint16
	var missing []string

	ciphers := tls.CipherSuites()
	var cipherMap = make(map[string]uint16, len(ciphers))
	for _, cipher := range ciphers {
		cipherMap[cipher.Name] = cipher.ID
	}

	for _, name := range names {
		name = strings.ToUpper(name)
		id, ok := cipherMap[name]
		if !ok {
			missing = append(missing, name)
			continue
		}
		ids = append(ids, id)
	}

	if len(missing) > 0 {
		return ids, fmt.Errorf("unknown ciphers: %v", missing)
	}

	return ids, nil
}

// tlsNameToVersion converts a tls version to a string
func TlsCipherIdsToString(ids []uint16) string {
	var tlsCiphers []string
	if len(ids) > 0 {
		for _, cipher := range ids {
			tlsCiphers = append(tlsCiphers, tls.CipherSuiteName(cipher))
		}
	}
	return strings.Join(tlsCiphers, ",")
}
