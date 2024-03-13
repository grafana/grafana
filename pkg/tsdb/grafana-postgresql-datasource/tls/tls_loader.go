package tls

import (
	"crypto/tls"
	"crypto/x509"
	"errors"

	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

// this file deals with locating and loading the certificates,
// from json-data or from disk.

type CertBytes struct {
	rootCert   []byte
	clientKey  []byte
	clientCert []byte
}

type ReadFileFunc = func(name string) ([]byte, error)

var errPartialClientCertNoKey = errors.New("tls: client cert provided but client key missing")
var errPartialClientCertNoCert = errors.New("tls: client key provided but client cert missing")

// certificates can be stored either as encrypted-json-data, or as file-path
func loadCertificateBytes(dsInfo sqleng.DataSourceInfo, readFile ReadFileFunc) (*CertBytes, error) {
	if dsInfo.JsonData.ConfigurationMethod == "file-content" {
		return &CertBytes{
			rootCert:   []byte(dsInfo.DecryptedSecureJSONData["tlsCACert"]),
			clientKey:  []byte(dsInfo.DecryptedSecureJSONData["tlsClientKey"]),
			clientCert: []byte(dsInfo.DecryptedSecureJSONData["tlsClientCert"]),
		}, nil
	} else {
		c := CertBytes{}

		if dsInfo.JsonData.RootCertFile != "" {
			rootCert, err := readFile(dsInfo.JsonData.RootCertFile)
			if err != nil {
				return nil, err
			}
			c.rootCert = rootCert
		}

		if dsInfo.JsonData.CertKeyFile != "" {
			clientKey, err := readFile(dsInfo.JsonData.CertKeyFile)
			if err != nil {
				return nil, err
			}
			c.clientKey = clientKey
		}

		if dsInfo.JsonData.CertFile != "" {
			clientCert, err := readFile(dsInfo.JsonData.CertFile)
			if err != nil {
				return nil, err
			}
			c.clientCert = clientCert
		}

		return &c, nil
	}
}

type Certs struct {
	clientCerts []tls.Certificate
	rootCerts   *x509.CertPool
}

func createCertificates(certBytes *CertBytes) (*Certs, error) {
	certs := Certs{}

	if len(certBytes.rootCert) > 0 {
		pool := x509.NewCertPool()
		ok := pool.AppendCertsFromPEM(certBytes.rootCert)
		if !ok {
			return nil, errors.New("tls: failed to add root certificate")
		}
		certs.rootCerts = pool
	}

	hasClientKey := len(certBytes.clientKey) > 0
	hasClientCert := len(certBytes.clientCert) > 0

	if hasClientKey && hasClientCert {
		cert, err := tls.X509KeyPair(certBytes.clientCert, certBytes.clientKey)
		if err != nil {
			return nil, err
		}
		certs.clientCerts = []tls.Certificate{cert}
	}

	if hasClientKey && (!hasClientCert) {
		return nil, errPartialClientCertNoCert
	}

	if hasClientCert && (!hasClientKey) {
		return nil, errPartialClientCertNoKey
	}

	return &certs, nil
}
