package utils

import (
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/authn"
)

// ParseUserIDFromSubject parses the user ID from format "user:id:<id>".
func ParseUserIDFromSubject(subject string) (int64, error) {
	trimmed := strings.TrimPrefix(subject, fmt.Sprintf("%s:id:", authn.NamespaceUser))
	return strconv.ParseInt(trimmed, 10, 64)
}

// ParsePublicKeyPem parses the public key from the PEM encoded public key.
func ParsePublicKeyPem(publicPem []byte) (interface{}, error) {
	block, _ := pem.Decode(publicPem)
	if block == nil {
		return nil, errors.New("could not decode PEM block")
	}

	switch block.Type {
	case "PUBLIC KEY":
		return x509.ParsePKIXPublicKey(block.Bytes)
	case "RSA PUBLIC KEY":
		return x509.ParsePKCS1PublicKey(block.Bytes)
	default:
		return nil, fmt.Errorf("unknown key type %q", block.Type)
	}
}
