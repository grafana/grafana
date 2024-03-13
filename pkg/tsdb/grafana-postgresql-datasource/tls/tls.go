package tls

import (
	"crypto/tls"
	"crypto/x509"
	"errors"

	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

// we support 4 postgres tls modes:
// disable     - no tls
// require     - use tls
// verify-ca   - use tls, verify root cert but not the hostname
// verify-full - use tls, verify root cert
// (for all the options except `disable`, you can optionally use client certificates)

func getTLSConfigRequire(certs *Certs, serverName string) (*tls.Config, error) {
	// see https://www.postgresql.org/docs/12/libpq-ssl.html ,
	// mode=require + provided root-cert should behave as mode=verify-ca
	if certs.rootCerts != nil {
		return getTLSConfigVerifyCA(certs, serverName)
	}

	return &tls.Config{
		InsecureSkipVerify: true, // we do not verify the root cert
		Certificates:       certs.clientCerts,
		ServerName:         serverName,
	}, nil
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
func getTLSConfigVerifyCA(certs *Certs, serverName string) (*tls.Config, error) {
	conf := tls.Config{
		ServerName:         serverName,
		Certificates:       certs.clientCerts,
		InsecureSkipVerify: true, // we turn off the default-verification, we'll do VerifyConnection instead
		VerifyConnection: func(state tls.ConnectionState) error {
			// we add all the certificates to the pool, we skip the first cert.
			intermediates := x509.NewCertPool()
			for _, c := range state.PeerCertificates[1:] {
				intermediates.AddCert(c)
			}

			opts := x509.VerifyOptions{
				Roots:         certs.rootCerts,
				Intermediates: intermediates,
			}

			// we call `Verify()` on the first cert (that we skipped previously)
			_, err := state.PeerCertificates[0].Verify(opts)
			return err
		},
		RootCAs: certs.rootCerts,
	}

	return &conf, nil
}

func getTLSConfigVerifyFull(certs *Certs, serverName string) (*tls.Config, error) {
	conf := tls.Config{
		Certificates: certs.clientCerts,
		ServerName:   serverName,
		RootCAs:      certs.rootCerts,
	}

	return &conf, nil
}

func IsTLSEnabled(dsInfo sqleng.DataSourceInfo) bool {
	mode := dsInfo.JsonData.Mode
	return mode != "disable"
}

// returns `nil` if tls is disabled
func GetTLSConfig(dsInfo sqleng.DataSourceInfo, readFile ReadFileFunc, serverName string) (*tls.Config, error) {
	mode := dsInfo.JsonData.Mode
	// we need to special-case the no-tls-mode
	if mode == "disable" {
		return nil, nil
	}

	// for all the remaining cases we need to load
	// both the root-cert if exists, and the client-cert if exists.
	certBytes, err := loadCertificateBytes(dsInfo, readFile)
	if err != nil {
		return nil, err
	}

	certs, err := createCertificates(certBytes)
	if err != nil {
		return nil, err
	}

	switch mode {
	// `disable` already handled
	case "":
		// for backward-compatibility reasons this is the same as `require`
		return getTLSConfigRequire(certs, serverName)
	case "require":
		return getTLSConfigRequire(certs, serverName)
	case "verify-ca":
		return getTLSConfigVerifyCA(certs, serverName)
	case "verify-full":
		return getTLSConfigVerifyFull(certs, serverName)
	default:
		return nil, errors.New("tls: invalid mode " + mode)
	}
}
