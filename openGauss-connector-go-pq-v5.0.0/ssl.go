package pq

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"os/user"
	"path"
	"strings"
	"sync"
)

// configTLS uses libpq's TLS parameters to construct  []*tls.Config. It is
// necessary to allow returning multiple TLS configs as sslmode "allow" and
// "prefer" allow fallback.
func configTLS(settings map[string]string) ([]*tls.Config, error) {
	host := settings[paramHost]
	sslmode := settings[paramSSLMode]
	sslrootcert := settings[paramSSLRootCert]
	sslcert := settings[paramSSLCert]
	sslkey := settings[paramSSLKey]

	// Match libpq default behavior
	if sslmode == "" {
		sslmode = "prefer"
	}
	tlsConfig := &tls.Config{}

	switch sslmode {
	case "disable":
		return []*tls.Config{nil}, nil
	case "allow", "prefer":
		tlsConfig.InsecureSkipVerify = true
	case "require":
		// According to PostgreSQL documentation, if a root CA file exists,
		// the behavior of sslmode=require should be the same as that of verify-ca
		//
		// See https://www.postgresql.org/docs/12/libpq-ssl.html
		if sslrootcert != "" {
			goto nextCase
		}
		tlsConfig.InsecureSkipVerify = true
		break
	nextCase:
		fallthrough
	case "verify-ca":
		// Don't perform the default certificate verification because it
		// will verify the hostname. Instead, verify the server's
		// certificate chain ourselves in VerifyPeerCertificate and
		// ignore the server name. This emulates libpq's verify-ca
		// behavior.
		//
		// See https://github.com/golang/go/issues/21971#issuecomment-332693931
		// and https://pkg.go.dev/crypto/tls?tab=doc#example-Config-VerifyPeerCertificate
		// for more info.
		tlsConfig.InsecureSkipVerify = true
		tlsConfig.VerifyPeerCertificate = func(certificates [][]byte, _ [][]*x509.Certificate) error {
			certs := make([]*x509.Certificate, len(certificates))
			for i, asn1Data := range certificates {
				cert, err := x509.ParseCertificate(asn1Data)
				if err != nil {
					return fmterrorf("failed to parse certificate from server: " + err.Error())
				}
				certs[i] = cert
			}

			// Leave DNSName empty to skip hostname verification.
			opts := x509.VerifyOptions{
				Roots:         tlsConfig.RootCAs,
				Intermediates: x509.NewCertPool(),
			}
			// Skip the first cert because it's the leaf. All others
			// are intermediates.
			for _, cert := range certs[1:] {
				opts.Intermediates.AddCert(cert)
			}
			_, err := certs[0].Verify(opts)
			return err
		}
	case "verify-full":
		tlsConfig.ServerName = host
	default:
		tlsConf := getTLSConfigClone(sslmode)
		if tlsConf == nil {
			return nil, fmterrorf("sslmode is invalid")
		}
		return []*tls.Config{tlsConf}, nil
	}

	if sslrootcert != "" {
		caCertPool := x509.NewCertPool()

		caPath := sslrootcert
		caCert, err := ioutil.ReadFile(caPath)
		if err != nil {
			return nil, fmt.Errorf("unable to read CA file: %w", err)
		}

		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmterrorf("unable to add CA to cert pool")
		}

		tlsConfig.RootCAs = caCertPool
		tlsConfig.ClientCAs = caCertPool
	}

	if (sslcert != "" && sslkey == "") || (sslcert == "" && sslkey != "") {
		return nil, fmterrorf(`both "sslcert" and "sslkey" are required`)
	}

	err := sslClientCertificates(tlsConfig, settings)
	if err != nil {
		return nil, err
	}
	err = sslCertificateAuthority(tlsConfig, settings)
	if err != nil {
		return nil, err
	}

	switch sslmode {
	case "allow":
		return []*tls.Config{nil, tlsConfig}, nil
	case "prefer":
		return []*tls.Config{tlsConfig, nil}, nil
	case "require", "verify-ca", "verify-full":
		return []*tls.Config{tlsConfig}, nil
	default:
		panic("BUG: bad sslmode should already have been caught")
	}
}

var (
	tlsConfigLock     sync.RWMutex
	tlsConfigRegistry map[string]*tls.Config
)

func RegisterTLSConfig(key string, config *tls.Config) error {
	if _, isBool := readBool(key); isBool ||
		strings.ToLower(key) == "require" ||
		strings.ToLower(key) == "verify-ca" ||
		strings.ToLower(key) == "verify-full" ||
		strings.ToLower(key) == "disable" {
		return fmt.Errorf("key '%s' is reserved", key)
	}

	tlsConfigLock.Lock()
	if tlsConfigRegistry == nil {
		tlsConfigRegistry = make(map[string]*tls.Config)
	}

	tlsConfigRegistry[key] = config
	tlsConfigLock.Unlock()
	return nil
}

// DeregisterTLSConfig removes the tls.Config associated with key.
func DeregisterTLSConfig(key string) {
	tlsConfigLock.Lock()
	if tlsConfigRegistry != nil {
		delete(tlsConfigRegistry, key)
	}
	tlsConfigLock.Unlock()
}

func getTLSConfigClone(key string) (config *tls.Config) {
	tlsConfigLock.RLock()
	if v, ok := tlsConfigRegistry[key]; ok {
		config = v.Clone()
	}
	tlsConfigLock.RUnlock()
	return
}

// Returns the bool value of the input.
// The 2nd return value indicates if the input was a valid bool value
func readBool(input string) (value bool, valid bool) {
	switch input {
	case "1", "true", "TRUE", "True":
		return true, true
	case "0", "false", "FALSE", "False":
		return false, true
	}

	// Not a valid bool value
	return
}

// ssl generates a function to upgrade a net.Conn based on the "sslmode" and
// related settings. The function is nil when no upgrade should take place.
func ssl(o values) (func(net.Conn) (net.Conn, error), error) {
	verifyCaOnly := false
	tlsConf := tls.Config{}
	switch mode := o[paramSSLMode]; mode {
	// "require" is the default.
	case "", "require":
		// We must skip TLS's own verification since it requires full
		// verification since Go 1.3.
		tlsConf.InsecureSkipVerify = true

		// From http://www.postgresql.org/docs/current/static/libpq-ssl.html:
		//
		// Note: For backwards compatibility with earlier versions of
		// PostgreSQL, if a root CA file exists, the behavior of
		// sslmode=require will be the same as that of verify-ca, meaning the
		// server certificate is validated against the CA. Relying on this
		// behavior is discouraged, and applications that need certificate
		// validation should always use verify-ca or verify-full.
		if sslrootcert, ok := o[paramSSLRootCert]; ok {
			if _, err := os.Stat(sslrootcert); err == nil {
				verifyCaOnly = true
			} else {
				delete(o, paramSSLRootCert)
			}
		}
	case "verify-ca":
		// We must skip TLS's own verification since it requires full
		// verification since Go 1.3.
		tlsConf.InsecureSkipVerify = true
		verifyCaOnly = true
	case "verify-full":
		tlsConf.ServerName = o[paramHost]
	case "disable":
		return nil, nil
	default:
		return nil, fmterrorf(
			`unsupported sslmode %q; only "require" (default), "verify-full", "verify-ca", and "disable" supported`,
			mode,
		)
	}

	err := sslClientCertificates(&tlsConf, o)
	if err != nil {
		return nil, err
	}
	err = sslCertificateAuthority(&tlsConf, o)
	if err != nil {
		return nil, err
	}

	// Accept renegotiation requests initiated by the backend.
	//
	// Renegotiation was deprecated then removed from PostgreSQL 9.5, but
	// the default configuration of older versions has it enabled. Redshift
	// also initiates renegotiations and cannot be reconfigured.
	tlsConf.Renegotiation = tls.RenegotiateFreelyAsClient

	return func(conn net.Conn) (net.Conn, error) {
		client := tls.Client(conn, &tlsConf)
		if verifyCaOnly {
			err := sslVerifyCertificateAuthority(client, &tlsConf)
			if err != nil {
				return nil, err
			}
		}
		return client, nil
	}, nil
}

// sslClientCertificates adds the certificate specified in the "sslcert" and
// "sslkey" settings, or if they aren't set, from the .postgresql directory
// in the user's home directory. The configured files must exist and have
// the correct permissions.
func sslClientCertificates(tlsConf *tls.Config, o values) error {
	var (
		sslCertBytes []byte
		sslKeyBytes  []byte
		err          error
	)
	sslInLine := o[paramSSLinLine]
	if sslInLine == "true" {
		sslCertBytes = []byte(o[paramSSLCert])
		sslKeyBytes = []byte(o[paramSSLKey])
		return nil
	} else {
		// user.Current() might fail when cross-compiling. We have to ignore the
		// error and continue without home directory defaults, since we wouldn't
		// know from where to load them.
		user, _ := user.Current()

		// In libpq, the client certificate is only loaded if the setting is not blank.
		//
		// https://github.com/postgres/postgres/blob/REL9_6_2/src/interfaces/libpq/fe-secure-openssl.c#L1036-L1037
		sslCert := o[paramSSLCert]
		if len(sslCert) == 0 && user != nil {
			sslCert = path.Join(user.HomeDir, ".postgresql", "postgresql.crt")
		}
		// https://github.com/postgres/postgres/blob/REL9_6_2/src/interfaces/libpq/fe-secure-openssl.c#L1045
		if len(sslCert) == 0 {
			return nil
		}
		// https://github.com/postgres/postgres/blob/REL9_6_2/src/interfaces/libpq/fe-secure-openssl.c#L1050:L1054
		if _, err := os.Stat(sslCert); os.IsNotExist(err) {
			return nil
		} else if err != nil {
			return err
		}

		// In libpq, the ssl key is only loaded if the setting is not blank.
		//
		// https://github.com/postgres/postgres/blob/REL9_6_2/src/interfaces/libpq/fe-secure-openssl.c#L1123-L1222
		sslKey := o[paramSSLKey]
		if len(sslKey) == 0 && user != nil {
			sslKey = path.Join(user.HomeDir, ".postgresql", "postgresql.key")
		}

		if len(sslKey) > 0 {
			if err = sslKeyPermissions(sslKey); err != nil {
				return err
			}
		}
		sslCertBytes, err = ioutil.ReadFile(sslCert)
		if err != nil {
			return err
		}
		sslKeyBytes, err = ioutil.ReadFile(sslKey)
		if err != nil {
			return err
		}
	}
	block, _ := pem.Decode(sslKeyBytes)
	if block == nil {
		return fmterrorf("ssh: no key found")
	}
	if x509.IsEncryptedPEMBlock(block) {
		sslPassword, ok := o[paramSSLPassword]
		if !ok {
			return fmterrorf("sslpassword is invalid")
		}
		buf, err := x509.DecryptPEMBlock(block, []byte(sslPassword))
		if err != nil {
			if err == x509.IncorrectPasswordError {
				return err
			}
			return fmt.Errorf("ssl: cannot decode sslkeys: %v", err)
		}
		block.Bytes = buf
		block.Headers = nil
		sslKeyBytes = pem.EncodeToMemory(block)
	}
	cert, err := tls.X509KeyPair(sslCertBytes, sslKeyBytes)
	if err != nil {
		fmt.Println("2", err)
		return err
	}

	tlsConf.Certificates = []tls.Certificate{cert}
	return nil
}

// sslCertificateAuthority adds the RootCA specified in the "sslrootcert" setting.
func sslCertificateAuthority(tlsConf *tls.Config, o values) error {
	// In libpq, the root certificate is only loaded if the setting is not blank.
	//
	// https://github.com/postgres/postgres/blob/REL9_6_2/src/interfaces/libpq/fe-secure-openssl.c#L950-L951
	if sslrootcert := o[paramSSLRootCert]; len(sslrootcert) > 0 {
		tlsConf.RootCAs = x509.NewCertPool()

		sslinline := o[paramSSLinLine]

		var cert []byte
		if sslinline == "true" {
			cert = []byte(sslrootcert)
		} else {
			var err error
			cert, err = ioutil.ReadFile(sslrootcert)
			if err != nil {
				return err
			}
		}

		if !tlsConf.RootCAs.AppendCertsFromPEM(cert) {
			return fmterrorf("couldn't parse pem in sslrootcert")
		}
	}

	return nil
}

// sslVerifyCertificateAuthority carries out a TLS handshake to the server and
// verifies the presented certificate against the CA, i.e. the one specified in
// sslrootcert or the system CA if sslrootcert was not specified.
func sslVerifyCertificateAuthority(client *tls.Conn, tlsConf *tls.Config) error {
	err := client.Handshake()
	if err != nil {
		return err
	}
	certs := client.ConnectionState().PeerCertificates
	opts := x509.VerifyOptions{
		DNSName:       client.ConnectionState().ServerName,
		Intermediates: x509.NewCertPool(),
		Roots:         tlsConf.RootCAs,
	}
	for i, cert := range certs {
		if i == 0 {
			continue
		}
		opts.Intermediates.AddCert(cert)
	}
	_, err = certs[0].Verify(opts)
	return err
}
