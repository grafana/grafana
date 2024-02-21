package tls

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"os"

	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

// we support 4 postgres tls modes:
// disable     - no tls
// require     - use tls
// verify-ca   - use tls, verify root cert but not the hostname
// verify-full - use tls, verify root cert
// (for all the options except `disable`, you can optionally use client certificates)

// certificates can be stored either as encrypted-json-data, or as file-path
func getCertBytes(method string, jsonValue string, path string) ([]byte, error) {
	if method == "file-content" {
		return []byte(jsonValue), nil
	} else {
		if path == "" {
			return nil, nil
		} else {
			// The functionality we provide allows the user to specify the file-path to the certificate,
			// so we have to be able to read it from an arbitrary path on the server.
			// The file-content will not be sent back to the user, instead it will be used to construct
			// certificates for the communication with the postgres database.
			// nolint:gosec
			return os.ReadFile(path)
		}
	}
}

func getTLSRootCert(dsInfo sqleng.DataSourceInfo) (*x509.CertPool, error) {
	method := dsInfo.JsonData.ConfigurationMethod
	certBytes, err := getCertBytes(method, dsInfo.DecryptedSecureJSONData["tlsCACert"], dsInfo.JsonData.RootCertFile)
	if err != nil {
		return nil, err
	}

	pool := x509.NewCertPool()
	ok := pool.AppendCertsFromPEM(certBytes)
	if !ok {
		return nil, errors.New("tls: failed to add root certificate")
	}

	return pool, nil
}

func getTLSClientCerts(dsInfo sqleng.DataSourceInfo) ([]tls.Certificate, error) {
	method := dsInfo.JsonData.ConfigurationMethod
	certBytes, err := getCertBytes(method, dsInfo.DecryptedSecureJSONData["tlsClientCert"], dsInfo.JsonData.CertFile)
	if err != nil {
		return nil, err
	}

	keyBytes, err := getCertBytes(method, dsInfo.DecryptedSecureJSONData["tlsClientKey"], dsInfo.JsonData.CertKeyFile)
	if err != nil {
		return nil, err
	}

	if (len(keyBytes) > 0) && (len(certBytes) == 0) {
		return nil, errors.New("tls: client key provided, but client cert missing")
	}

	if (len(keyBytes) == 0) && (len(certBytes) > 0) {
		return nil, errors.New("tls: client cert provided, but client key missing")
	}

	if (len(keyBytes) > 0) && (len(certBytes) > 0) {
		cert, err := tls.X509KeyPair(certBytes, keyBytes)
		if err != nil {
			return nil, err
		}
		return []tls.Certificate{cert}, nil
	}

	return nil, nil
}

func getTLSConfigRequire(dsInfo sqleng.DataSourceInfo) (*tls.Config, error) {
	// we may have a client-cert, we do not have a root-cert
	clientCerts, err := getTLSClientCerts(dsInfo)
	if err != nil {
		return nil, err
	}

	conf := tls.Config{
		InsecureSkipVerify: true, // we do not verify the root cert
		Certificates:       clientCerts,
	}

	return &conf, nil
}

// to implement the verify-ca mode, we need to do this:
// - for the root certificate
//   - verify that the certificate we receive from the server is trusted,
//     meaning it relates to our root certificate
//   - we DO NOT verify that the hostname of the database matches
//     the hostname in the certificate
//
// the problem is, `go“ does not offer such an option.
// by default, it will verify both things.
//
// so what we do is:
// - we turn off the default-verification with `InsecureSkipVerify`
// - we implement our own verification using `VerifyConnection`
//
// extra info about this:
//   - there is a rejected feature-request about this at https://github.com/golang/go/issues/21971
//   - the recommended workaround is based on VerifyPeerCertificate
//   - there is even example code at https://github.com/golang/go/commit/29cfb4d3c3a97b6f426d1b899234da905be699aa
//   - but later the example code was changed to use VerifyConnection instead:
//     https://github.com/golang/go/commit/7eb5941b95a588a23f18fa4c22fe42ff0119c311
//
// a verifyConnection example is at https://pkg.go.dev/crypto/tls#example-Config-VerifyConnection .
//
// this is how the `pgx` library handles verify-ca:
//
//	https://github.com/jackc/pgx/blob/5c63f646f820ca9696fc3515c1caf2a557d562e5/pgconn/config.go#L657-L690
//		(unfortunately pgx only handles this for certificate-provided-as-path, so we cannot rely on it)
func getTLSConfigVerifyCA(dsInfo sqleng.DataSourceInfo) (*tls.Config, error) {
	// we may have a client-cert, we do have a root-cert
	clientCerts, err := getTLSClientCerts(dsInfo)
	if err != nil {
		return nil, err
	}

	rootCert, err := getTLSRootCert(dsInfo)
	if err != nil {
		return nil, err
	}

	conf := tls.Config{
		Certificates:       clientCerts,
		InsecureSkipVerify: true, // we turn off the default-verification, we'll do VerifyConnection instead
		VerifyConnection: func(state tls.ConnectionState) error {
			// we add all the certificates to the pool, we skip the first cert.
			intermediates := x509.NewCertPool()
			for _, c := range state.PeerCertificates[1:] {
				intermediates.AddCert(c)
			}

			opts := x509.VerifyOptions{
				Roots:         rootCert,
				Intermediates: intermediates,
			}

			// we call `Verify()` on the first cert (that we skipped previously)
			_, err := state.PeerCertificates[0].Verify(opts)
			return err
		},
		RootCAs: rootCert,
	}

	return &conf, nil
}

func getTLSConfigVerifyFull(dsInfo sqleng.DataSourceInfo, serverName string) (*tls.Config, error) {
	// we may have a client-cert, we do have a root-cert
	clientCerts, err := getTLSClientCerts(dsInfo)
	if err != nil {
		return nil, err
	}

	rootCert, err := getTLSRootCert(dsInfo)
	if err != nil {
		return nil, err
	}

	conf := tls.Config{
		Certificates: clientCerts,
		ServerName:   serverName,
		RootCAs:      rootCert,
	}

	return &conf, nil
}

func IsTLSEnabled(dsInfo sqleng.DataSourceInfo) bool {
	mode := dsInfo.JsonData.Mode
	return mode != "disable"
}

// returns `nil` if tls is disabled
func GetTLSConfig(dsInfo sqleng.DataSourceInfo, serverName string) (*tls.Config, error) {
	mode := dsInfo.JsonData.Mode
	switch mode {
	case "disable":
		return nil, nil
	case "require":
		return getTLSConfigRequire(dsInfo)
	case "verify-ca":
		return getTLSConfigVerifyCA(dsInfo)
	case "verify-full":
		return getTLSConfigVerifyFull(dsInfo, serverName)
	default:
		// FIXME: what now?
		return nil, errors.New("tls: invalid mode " + mode)
	}
}
