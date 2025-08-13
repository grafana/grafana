package pq

// This file contains SSL tests

import (
	_ "crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"fmt"
	"github.com/stretchr/testify/assert"
	"os"
	"path/filepath"
	"testing"
)

func maybeSkipSSLTests(t *testing.T) {
	// Require some special variables for testing certificates
	if os.Getenv("PQSSLCERTTEST_PATH") == "" {
		t.Skip("PQSSLCERTTEST_PATH not set, skipping SSL tests")
	}

	value := os.Getenv("PQGOSSLTESTS")
	if value == "" || value == "0" {
		t.Skip("PQGOSSLTESTS not enabled, skipping SSL tests")
	} else if value != "1" {
		t.Fatalf("unexpected value %q for PQGOSSLTESTS", value)
	}
}

func openSSLConn(t *testing.T, conninfo string) (*sql.DB, error) {
	db, err := openTestConnConninfo(conninfo)
	if err != nil {
		// should never fail
		t.Fatal(err)
	}
	// Do something with the connection to see whether it's working or not.
	tx, err := db.Begin()
	if err == nil {
		return db, tx.Rollback()
	}
	_ = db.Close()
	return nil, err
}

func checkSSLSetup(t *testing.T, conninfo string) {
	_, err := openSSLConn(t, conninfo)
	if pge, ok := err.(*Error); ok {
		if pge.Code.Name() != "invalid_authorization_specification" {
			t.Fatalf("unexpected error code '%s'", pge.Code.Name())
		}
	} else {
		t.Fatalf("expected %T, got %v", (*Error)(nil), err)
	}
}

// Connect over SSL and run a simple query to test the basics
func TestSSLConnection(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	db, err := openSSLConn(t, "sslmode=require user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}
	rows, err := db.Query("SELECT 1")
	if err != nil {
		t.Fatal(err)
	}
	rows.Close()
}

// Test sslmode=verify-full
func TestSSLVerifyFull(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	// Not OK according to the system CA
	_, err := openSSLConn(t, "host=postgres sslmode=verify-full user=pqgossltest")
	if err == nil {
		t.Fatal("expected error")
	}
	_, ok := err.(x509.UnknownAuthorityError)
	if !ok {
		_, ok := err.(x509.HostnameError)
		if !ok {
			t.Fatalf("expected x509.UnknownAuthorityError or x509.HostnameError, got %#+v", err)
		}
	}

	rootCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "root.crt")
	rootCert := "sslrootcert=" + rootCertPath + " "
	// No match on Common Name
	_, err = openSSLConn(t, rootCert+"host=127.0.0.1 sslmode=verify-full user=pqgossltest")
	if err == nil {
		t.Fatal("expected error")
	}
	_, ok = err.(x509.HostnameError)
	if !ok {
		t.Fatalf("expected x509.HostnameError, got %#+v", err)
	}
	// OK
	_, err = openSSLConn(t, rootCert+"host=postgres sslmode=verify-full user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}
}

// Test sslmode=require sslrootcert=rootCertPath
func TestSSLRequireWithRootCert(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	bogusRootCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "bogus_root.crt")
	bogusRootCert := "sslrootcert=" + bogusRootCertPath + " "

	// Not OK according to the bogus CA
	_, err := openSSLConn(t, bogusRootCert+"host=postgres sslmode=require user=pqgossltest")
	if err == nil {
		t.Fatal("expected error")
	}
	_, ok := err.(x509.UnknownAuthorityError)
	if !ok {
		t.Fatalf("expected x509.UnknownAuthorityError, got %s, %#+v", err, err)
	}

	nonExistentCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "non_existent.crt")
	nonExistentCert := "sslrootcert=" + nonExistentCertPath + " "

	// No match on Common Name, but that's OK because we're not validating anything.
	_, err = openSSLConn(t, nonExistentCert+"host=127.0.0.1 sslmode=require user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}

	rootCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "root.crt")
	rootCert := "sslrootcert=" + rootCertPath + " "

	// No match on Common Name, but that's OK because we're not validating the CN.
	_, err = openSSLConn(t, rootCert+"host=127.0.0.1 sslmode=require user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}
	// Everything OK
	_, err = openSSLConn(t, rootCert+"host=postgres sslmode=require user=pqgossltest")
	if err != nil {
		t.Fatal(err)
	}
}

// Test sslmode=verify-ca
func TestSSLVerifyCA(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	// Not OK according to the system CA
	{
		_, err := openSSLConn(t, "host=postgres sslmode=verify-ca user=pqgossltest")
		if _, ok := err.(x509.UnknownAuthorityError); !ok {
			t.Fatalf("expected %T, got %#+v", x509.UnknownAuthorityError{}, err)
		}
	}

	// Still not OK according to the system CA; empty sslrootcert is treated as unspecified.
	{
		_, err := openSSLConn(t, "host=postgres sslmode=verify-ca user=pqgossltest sslrootcert=''")
		if _, ok := err.(x509.UnknownAuthorityError); !ok {
			t.Fatalf("expected %T, got %#+v", x509.UnknownAuthorityError{}, err)
		}
	}

	rootCertPath := filepath.Join(os.Getenv("PQSSLCERTTEST_PATH"), "root.crt")
	rootCert := "sslrootcert=" + rootCertPath + " "
	// No match on Common Name, but that's OK
	if _, err := openSSLConn(t, rootCert+"host=127.0.0.1 sslmode=verify-ca user=pqgossltest"); err != nil {
		t.Fatal(err)
	}
	// Everything OK
	if _, err := openSSLConn(t, rootCert+"host=postgres sslmode=verify-ca user=pqgossltest"); err != nil {
		t.Fatal(err)
	}
}

// Authenticate over SSL using client certificates
func TestSSLClientCertificates(t *testing.T) {
	maybeSkipSSLTests(t)
	// Environment sanity check: should fail without SSL
	checkSSLSetup(t, "sslmode=disable user=pqgossltest")

	const baseinfo = "sslmode=require user=pqgosslcert"

	// Certificate not specified, should fail
	{
		_, err := openSSLConn(t, baseinfo)
		if pge, ok := err.(*Error); ok {
			if pge.Code.Name() != "invalid_authorization_specification" {
				t.Fatalf("unexpected error code '%s'", pge.Code.Name())
			}
		} else {
			t.Fatalf("expected %T, got %v", (*Error)(nil), err)
		}
	}

	// Empty certificate specified, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert=''")
		if pge, ok := err.(*Error); ok {
			if pge.Code.Name() != "invalid_authorization_specification" {
				t.Fatalf("unexpected error code '%s'", pge.Code.Name())
			}
		} else {
			t.Fatalf("expected %T, got %v", (*Error)(nil), err)
		}
	}

	// Non-existent certificate specified, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert=/tmp/filedoesnotexist")
		if pge, ok := err.(*Error); ok {
			if pge.Code.Name() != "invalid_authorization_specification" {
				t.Fatalf("unexpected error code '%s'", pge.Code.Name())
			}
		} else {
			t.Fatalf("expected %T, got %v", (*Error)(nil), err)
		}
	}

	certpath, ok := os.LookupEnv("PQSSLCERTTEST_PATH")
	if !ok {
		t.Fatalf("PQSSLCERTTEST_PATH not present in environment")
	}

	sslcert := filepath.Join(certpath, "postgresql.crt")

	// Cert present, key not specified, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert="+sslcert)
		if _, ok := err.(*os.PathError); !ok {
			t.Fatalf("expected %T, got %#+v", (*os.PathError)(nil), err)
		}
	}

	// Cert present, empty key specified, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert="+sslcert+" sslkey=''")
		if _, ok := err.(*os.PathError); !ok {
			t.Fatalf("expected %T, got %#+v", (*os.PathError)(nil), err)
		}
	}

	// Cert present, non-existent key, should fail
	{
		_, err := openSSLConn(t, baseinfo+" sslcert="+sslcert+" sslkey=/tmp/filedoesnotexist")
		if _, ok := err.(*os.PathError); !ok {
			t.Fatalf("expected %T, got %#+v", (*os.PathError)(nil), err)
		}
	}

	// Key has wrong permissions (passing the cert as the key), should fail
	if _, err := openSSLConn(t, baseinfo+" sslcert="+sslcert+" sslkey="+sslcert); err != ErrSSLKeyHasWorldPermissions {
		t.Fatalf("expected %s, got %#+v", ErrSSLKeyHasWorldPermissions, err)
	}

	sslkey := filepath.Join(certpath, "postgresql.key")

	// Should work
	if db, err := openSSLConn(t, baseinfo+" sslcert="+sslcert+" sslkey="+sslkey); err != nil {
		t.Fatal(err)
	} else {
		rows, err := db.Query("SELECT 1")
		if err != nil {
			t.Fatal(err)
		}
		if err := rows.Close(); err != nil {
			t.Fatal(err)
		}
		if err := db.Close(); err != nil {
			t.Fatal(err)
		}
	}
}

func Test_sslClientCertificates(t *testing.T) {
	/*
		openssl genrsa -des3 -out root.key 4096
		openssl rsa -in root.key -out root.key
		openssl req -new -x509 -days 365 -subj "/CN=postgres" \
		-key root.key -out root.crt


		## server

		openssl genrsa -des3 -out server.key 4096
		openssl rsa -in server.key -out server.key
		openssl req -new -key server.key -subj "/CN=localhost" \
			-text -out server.csr
		openssl x509 -req -in server.csr -text -days 365 \
			-CA root.crt -CAkey root.key -CAcreateserial -out server.crt



	*/
	type args struct {
		tlsConf *tls.Config
		o       values
	}
	tests := []struct {
		name    string
		args    args
		wantErr assert.ErrorAssertionFunc
	}{
		/*
			openssl genrsa -out client.key 4096
			openssl rsa -in client.key -out client.key
			openssl req -new -key client.key -subj "/CN=fenix" \
				-out client.csr
			openssl x509 -req -in client.csr -CA root.crt \
				-CAkey root.key -CAcreateserial -days 365 \
				-text -out client.crt
		*/
		{
			name: "ssl_no_password_sslinline",
			args: args{
				tlsConf: &tls.Config{},
				o: map[string]string{
					paramSSLCert:   "Certificate:\n    Data:\n        Version: 1 (0x0)\n        Serial Number:\n            28:ad:77:11:75:ae:93:8d:ea:a2:5f:bf:33:e2:24:28:dc:28:c0:e7\n        Signature Algorithm: sha256WithRSAEncryption\n        Issuer: CN = postgres\n        Validity\n            Not Before: Feb 11 11:48:27 2022 GMT\n            Not After : Feb 11 11:48:27 2023 GMT\n        Subject: CN = fenix\n        Subject Public Key Info:\n            Public Key Algorithm: rsaEncryption\n                RSA Public-Key: (4096 bit)\n                Modulus:\n                    00:bf:ae:99:10:0a:e9:e8:7b:fb:84:f5:82:dc:66:\n                    9e:8d:2f:40:12:d7:8a:96:ce:c9:ca:24:99:29:d7:\n                    11:ff:5a:39:5c:3b:96:66:3f:55:04:02:66:98:e8:\n                    44:65:b3:f9:7b:eb:af:83:35:e5:23:4b:1f:6f:43:\n                    14:c0:df:7d:6f:96:f2:a6:18:65:49:71:84:f1:ce:\n                    69:c8:50:83:e2:99:5c:f7:63:48:b3:26:0a:66:91:\n                    dd:91:e4:86:c6:06:5c:7d:ce:33:7e:c8:53:3e:c9:\n                    8d:12:5f:e3:52:d1:c7:68:24:11:2e:d7:55:5d:e9:\n                    e2:36:2d:ff:ef:15:76:77:11:4e:24:db:fc:b6:64:\n                    f1:e4:ab:17:69:9b:d1:59:39:6c:60:5e:be:1f:0b:\n                    2a:db:82:0c:a8:71:74:2a:ef:ac:6c:63:9b:e1:22:\n                    8a:d0:29:1d:bd:2d:d3:ed:76:82:04:b5:1d:c5:66:\n                    17:10:fc:3f:ff:9a:7b:0c:61:b2:86:f9:19:3a:c4:\n                    e1:e4:e9:6e:67:04:c8:72:3a:bc:c1:b4:3a:33:c9:\n                    9f:29:db:3c:c4:04:0e:f7:72:45:19:16:1e:e1:b8:\n                    ad:59:e8:8a:65:64:d4:7f:8f:07:65:03:98:16:fa:\n                    e6:7d:cd:f5:01:57:b4:05:2b:1d:bb:02:04:a0:57:\n                    f4:0c:c5:db:45:8a:46:64:31:3a:4d:c9:94:57:f0:\n                    45:37:72:61:16:8c:9e:31:39:af:4d:0f:f0:6a:88:\n                    8f:a5:9b:88:8f:40:02:98:0f:7c:8d:ae:99:fb:58:\n                    98:99:6c:8f:a2:de:ac:6d:17:ca:99:9c:c9:47:63:\n                    c5:2b:dc:fd:7a:3e:90:13:b6:57:e4:b3:3c:80:2f:\n                    bf:e4:22:20:02:6c:2c:09:37:7d:86:ef:85:36:87:\n                    41:e0:00:dc:e1:4e:86:e6:7e:0b:2f:fc:23:1c:db:\n                    b6:ee:75:d9:d7:8e:09:ac:7b:2e:6a:77:2f:03:01:\n                    fe:14:f5:70:ea:72:62:31:91:25:a7:b1:c0:c5:93:\n                    16:2c:72:21:64:89:5f:da:1d:57:bd:fb:7c:45:e2:\n                    d3:3f:92:3b:80:31:e0:6a:ed:60:8f:ab:9d:77:c5:\n                    7d:88:48:92:7f:74:11:2a:6d:f4:20:51:52:26:9a:\n                    15:8c:64:f2:2e:96:bd:16:f7:96:ad:e7:36:ca:6b:\n                    2c:99:58:5f:97:e8:74:58:57:5d:ff:ec:3a:07:1a:\n                    b5:bc:92:cb:e4:d0:f6:58:d9:30:4b:ad:57:16:9f:\n                    c7:72:31:79:97:93:76:de:7c:29:a2:57:fe:20:a5:\n                    52:1a:95:47:45:d6:d2:4a:15:28:a0:ae:c4:ac:37:\n                    71:cf:37\n                Exponent: 65537 (0x10001)\n    Signature Algorithm: sha256WithRSAEncryption\n         b0:ab:7a:2d:16:de:0a:24:4a:af:f5:3f:d7:d2:ad:8e:60:3e:\n         25:bd:48:60:57:a7:c5:22:82:ae:b1:31:a0:39:48:4e:be:2f:\n         b8:91:ce:22:b7:6f:fa:09:e6:5b:91:e8:11:b3:d7:86:0f:01:\n         f8:db:50:ba:7f:fb:86:94:49:a4:60:e8:b5:b0:ae:75:35:a9:\n         a8:54:57:6e:06:14:52:61:12:4f:07:be:8a:68:6a:a3:bc:79:\n         42:40:ce:2d:52:1f:e0:f9:a6:af:a4:bb:ae:37:bd:46:cd:6d:\n         e9:83:c1:e9:ab:4c:da:4c:56:d2:0a:d0:83:71:a2:58:d9:54:\n         9f:92:d3:94:ff:60:69:1d:fb:ce:ce:55:49:be:fe:3f:41:93:\n         2a:c5:97:05:f5:10:74:90:a6:b3:bd:b7:e4:d9:3b:f0:d7:15:\n         9f:d2:e9:eb:10:25:e7:f1:ed:33:25:e6:ca:45:d1:cc:18:48:\n         73:1c:06:e7:1b:80:41:d0:c4:69:fd:4d:a3:a5:88:b6:b1:58:\n         ad:2a:27:57:27:15:6d:61:4d:14:cc:7d:b6:ab:6f:00:6e:72:\n         98:5f:85:72:ef:f6:02:01:2c:01:2c:0b:ff:69:fc:18:72:5e:\n         38:c7:a5:6e:8d:b8:21:26:1c:f3:d8:5e:51:00:47:d7:22:08:\n         3f:32:96:48:4c:b3:77:62:fa:c1:d9:d0:6f:41:ff:cd:07:98:\n         53:f0:58:96:fb:26:f3:5b:15:05:2a:ae:19:76:34:79:c2:aa:\n         a8:8c:6b:96:88:7c:56:c4:8d:be:74:aa:f8:a7:0f:3a:5d:d2:\n         77:0f:8b:7e:3f:76:ea:c4:48:33:fc:2f:84:a6:54:33:33:6f:\n         33:4d:07:d9:6f:b7:8a:73:0f:aa:82:7f:c4:f1:de:58:1e:55:\n         cc:75:af:53:ed:e0:20:8d:68:02:f4:c1:7d:fc:96:6e:f6:1b:\n         3e:79:fa:f3:bb:4f:4e:50:a7:33:de:34:63:2a:0c:58:fc:b6:\n         69:cd:e4:49:6e:34:f2:ef:6b:13:b3:0b:81:13:80:9d:07:a6:\n         cd:1c:79:ed:6d:f1:3e:53:9d:f7:df:76:16:08:8d:99:e8:bb:\n         ef:e7:82:9a:72:6c:ff:9d:31:d4:ed:bd:1f:c2:73:e3:b1:91:\n         c1:ab:5e:7e:f8:1f:be:32:43:e2:46:fa:a2:ac:90:ff:a3:9f:\n         bb:f0:af:b6:67:06:02:3b:7e:d2:38:2e:f7:6d:b4:55:41:2a:\n         d8:f8:90:3c:06:76:6e:69:0c:39:05:a7:0b:dd:db:dc:65:0f:\n         f7:45:92:11:4c:b4:dc:43:72:03:e2:78:61:f6:10:c3:8d:0b:\n         3e:82:d3:97:f4:69:56:b5\n-----BEGIN CERTIFICATE-----\nMIIEqjCCApICFCitdxF1rpON6qJfvzPiJCjcKMDnMA0GCSqGSIb3DQEBCwUAMBMx\nETAPBgNVBAMMCHBvc3RncmVzMB4XDTIyMDIxMTExNDgyN1oXDTIzMDIxMTExNDgy\nN1owEDEOMAwGA1UEAwwFZmVuaXgwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK\nAoICAQC/rpkQCunoe/uE9YLcZp6NL0AS14qWzsnKJJkp1xH/WjlcO5ZmP1UEAmaY\n6ERls/l766+DNeUjSx9vQxTA331vlvKmGGVJcYTxzmnIUIPimVz3Y0izJgpmkd2R\n5IbGBlx9zjN+yFM+yY0SX+NS0cdoJBEu11Vd6eI2Lf/vFXZ3EU4k2/y2ZPHkqxdp\nm9FZOWxgXr4fCyrbggyocXQq76xsY5vhIorQKR29LdPtdoIEtR3FZhcQ/D//mnsM\nYbKG+Rk6xOHk6W5nBMhyOrzBtDozyZ8p2zzEBA73ckUZFh7huK1Z6IplZNR/jwdl\nA5gW+uZ9zfUBV7QFKx27AgSgV/QMxdtFikZkMTpNyZRX8EU3cmEWjJ4xOa9ND/Bq\niI+lm4iPQAKYD3yNrpn7WJiZbI+i3qxtF8qZnMlHY8Ur3P16PpATtlfkszyAL7/k\nIiACbCwJN32G74U2h0HgANzhTobmfgsv/CMc27buddnXjgmsey5qdy8DAf4U9XDq\ncmIxkSWnscDFkxYsciFkiV/aHVe9+3xF4tM/kjuAMeBq7WCPq513xX2ISJJ/dBEq\nbfQgUVImmhWMZPIulr0W95at5zbKayyZWF+X6HRYV13/7DoHGrW8ksvk0PZY2TBL\nrVcWn8dyMXmXk3befCmiV/4gpVIalUdF1tJKFSigrsSsN3HPNwIDAQABMA0GCSqG\nSIb3DQEBCwUAA4ICAQCwq3otFt4KJEqv9T/X0q2OYD4lvUhgV6fFIoKusTGgOUhO\nvi+4kc4it2/6CeZbkegRs9eGDwH421C6f/uGlEmkYOi1sK51NamoVFduBhRSYRJP\nB76KaGqjvHlCQM4tUh/g+aavpLuuN71GzW3pg8Hpq0zaTFbSCtCDcaJY2VSfktOU\n/2BpHfvOzlVJvv4/QZMqxZcF9RB0kKazvbfk2Tvw1xWf0unrECXn8e0zJebKRdHM\nGEhzHAbnG4BB0MRp/U2jpYi2sVitKidXJxVtYU0UzH22q28AbnKYX4Vy7/YCASwB\nLAv/afwYcl44x6VujbghJhzz2F5RAEfXIgg/MpZITLN3YvrB2dBvQf/NB5hT8FiW\n+ybzWxUFKq4ZdjR5wqqojGuWiHxWxI2+dKr4pw86XdJ3D4t+P3bqxEgz/C+EplQz\nM28zTQfZb7eKcw+qgn/E8d5YHlXMda9T7eAgjWgC9MF9/JZu9hs+efrzu09OUKcz\n3jRjKgxY/LZpzeRJbjTy72sTswuBE4CdB6bNHHntbfE+U53333YWCI2Z6Lvv54Ka\ncmz/nTHU7b0fwnPjsZHBq15++B++MkPiRvqirJD/o5+78K+2ZwYCO37SOC73bbRV\nQSrY+JA8BnZuaQw5BacL3dvcZQ/3RZIRTLTcQ3ID4nhh9hDDjQs+gtOX9GlWtQ==\n-----END CERTIFICATE-----\n",
					paramSSLKey:    "-----BEGIN RSA PRIVATE KEY-----\n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\n-----END RSA PRIVATE KEY-----\n",
					paramSSLinLine: "true",
				},
			},
			wantErr: assert.NoError,
		},
		/*
			openssl genrsa -des3 -out client2.key 4096
			openssl rsa -in client2.key -out client2.key
			openssl req -new -key client2.key -subj "/CN=fenix" \
				-out client2.csr
			openssl x509 -req -in client2.csr -CA root.crt \
				-CAkey root.key -CAcreateserial -days 365 \
				-text -out client2.crt
		*/
		{
			name: "ssl_password_sslinline",
			args: args{
				tlsConf: &tls.Config{},
				o: map[string]string{
					paramSSLCert:     "Certificate:\n    Data:\n        Version: 1 (0x0)\n        Serial Number:\n            28:ad:77:11:75:ae:93:8d:ea:a2:5f:bf:33:e2:24:28:dc:28:c0:e8\n        Signature Algorithm: sha256WithRSAEncryption\n        Issuer: CN = postgres\n        Validity\n            Not Before: Feb 11 11:51:14 2022 GMT\n            Not After : Feb 11 11:51:14 2023 GMT\n        Subject: CN = fenix\n        Subject Public Key Info:\n            Public Key Algorithm: rsaEncryption\n                RSA Public-Key: (4096 bit)\n                Modulus:\n                    00:b2:87:23:b8:ac:93:c9:13:cc:2d:4e:80:f3:07:\n                    06:58:5d:d5:ff:97:64:89:34:75:84:c5:84:80:2d:\n                    0a:45:26:88:a6:1b:41:ac:80:a1:ea:7e:2f:66:e4:\n                    e9:bd:1f:12:10:58:50:4b:20:2e:91:88:e7:ea:94:\n                    15:7e:6b:9b:51:30:b9:b6:9c:f7:9d:44:35:65:39:\n                    65:14:20:b5:24:b4:55:13:8e:40:32:ae:5f:84:15:\n                    8a:a6:a4:c8:52:7f:d1:bb:05:00:c0:f9:02:23:eb:\n                    d6:4f:a3:96:94:33:7b:b3:9a:15:96:83:27:1d:d6:\n                    e6:42:aa:68:52:28:da:dd:b5:14:e8:3f:fd:1c:92:\n                    5f:10:f4:18:cb:d2:c3:57:87:bc:14:89:14:27:e6:\n                    15:5b:96:f3:17:ce:a3:c6:60:07:49:16:aa:ae:4b:\n                    e7:d3:be:ff:e4:3d:ac:5b:5b:6e:e5:ad:6c:6c:c8:\n                    95:09:c3:51:da:4a:15:c6:93:70:4c:b0:f8:53:60:\n                    02:f0:d1:23:03:ba:e4:e3:50:14:f6:1d:84:e5:13:\n                    52:81:2f:d0:f5:7f:90:f1:94:ff:a1:11:6a:b8:4f:\n                    e2:70:16:d0:cb:7b:04:2e:22:db:c0:87:08:5f:bb:\n                    fc:2c:8e:09:08:27:b9:ab:40:20:32:2f:ca:f1:51:\n                    02:ee:56:76:c1:30:3b:6f:27:ef:22:48:cd:6e:64:\n                    29:31:d5:d4:4b:d4:9d:9f:e3:c1:53:54:b7:d5:90:\n                    1c:ce:45:3c:71:7f:76:30:b0:e9:0e:b1:69:17:41:\n                    3b:b7:30:53:59:79:20:85:9d:80:56:cf:55:ad:4a:\n                    78:f5:13:ce:d0:ed:db:0e:b3:5e:66:21:b4:de:e0:\n                    1d:e2:52:3d:3d:c2:74:52:fa:78:0b:75:50:6c:db:\n                    d6:9d:e8:47:6b:78:78:fe:cb:3b:3b:59:7c:6b:b7:\n                    1a:55:6a:52:77:4d:84:34:64:72:b6:de:30:e2:bc:\n                    f8:a8:4c:f7:e8:3f:e4:3a:3b:0f:a7:ca:43:73:09:\n                    40:5c:c7:5e:da:49:f7:b2:3e:63:81:6c:c2:1e:38:\n                    48:0b:51:54:c7:75:19:dd:a9:95:92:da:d8:d8:4a:\n                    11:f1:5c:6f:bf:55:d2:5f:ef:42:c4:c5:7e:78:3f:\n                    d5:1c:5b:b8:0e:d7:7c:51:fc:39:c1:4c:63:51:7c:\n                    e0:69:ac:92:c5:ba:9e:7f:5f:b9:a8:49:ac:a9:b5:\n                    29:ee:fe:62:e8:1f:c8:e5:96:67:e4:69:85:8b:bb:\n                    92:db:74:95:6a:ae:38:fe:a3:61:c3:03:52:7c:a3:\n                    0f:f8:e3:72:10:3a:6f:9b:08:72:a4:2f:7f:29:9c:\n                    61:4d:a1\n                Exponent: 65537 (0x10001)\n    Signature Algorithm: sha256WithRSAEncryption\n         3c:2c:a4:3f:34:b5:a7:17:a9:6b:8e:35:08:db:82:91:0b:13:\n         09:5f:d7:6d:3b:ba:da:53:0a:58:84:5d:e8:45:ed:21:eb:f3:\n         79:88:31:3c:dc:1b:02:f6:34:11:6f:fd:8e:1c:a2:9e:14:41:\n         04:1a:0e:23:49:04:a5:77:a3:11:f6:8a:38:19:63:c8:86:26:\n         fe:a6:8d:48:37:d8:16:19:bb:6a:b1:51:31:3c:f9:bd:3d:7e:\n         af:d6:3d:7e:cd:aa:a9:e8:9c:ec:5b:d7:b2:23:55:fa:cf:d6:\n         bc:23:3e:1c:08:39:7a:b5:36:b7:39:ca:07:d0:6e:35:f5:b7:\n         2a:46:2f:62:28:b5:12:ca:06:7f:07:bc:ab:9f:d7:c3:59:d3:\n         eb:31:8b:46:54:5b:1d:78:5c:79:5e:53:54:a7:b8:60:a6:9e:\n         1b:44:3f:32:76:f8:12:b8:f4:f9:dd:32:2e:0e:0e:e2:4f:0c:\n         50:c7:5c:dc:aa:42:f8:0d:b9:3b:34:b1:ad:dc:45:7e:33:80:\n         4c:53:4f:ec:9d:36:2f:73:06:aa:fd:f1:44:c2:3f:1f:1f:3b:\n         53:f3:40:f2:f5:76:dc:07:ba:50:96:e7:e5:f1:67:81:a7:56:\n         8f:4d:8e:5e:59:b8:58:10:4a:e1:e4:34:8b:b7:2a:45:7f:e4:\n         ff:44:3b:73:1e:3b:64:64:2d:2b:f0:e5:bc:94:50:ce:e0:05:\n         5a:1a:44:4d:3d:8d:1e:0c:18:13:be:9d:ac:37:bd:59:a1:72:\n         53:f3:f9:3c:fa:4e:5d:37:1c:ea:69:68:26:52:64:05:76:b0:\n         2c:d2:30:d5:7d:98:3c:5b:ef:18:26:69:d8:0a:bd:ee:04:f8:\n         02:f7:66:5b:07:14:b6:e6:5f:c1:3d:8a:cb:c0:12:15:c4:33:\n         ad:cf:67:e8:f0:31:77:79:90:77:c0:5e:37:72:5b:e0:08:bf:\n         b9:f3:06:0d:ec:68:83:22:50:ca:73:78:1e:f4:90:35:32:b0:\n         af:64:7b:b7:54:44:4c:fe:72:43:11:f6:b6:8c:be:aa:19:5d:\n         c8:9d:75:5f:97:a7:7f:e7:36:27:39:98:a9:77:d3:fe:bf:2b:\n         db:56:c2:08:ad:c3:a6:36:e0:9b:fa:41:22:44:2f:55:04:46:\n         b7:97:24:cc:51:5b:a2:ed:a4:f9:dd:b6:54:02:2c:42:71:96:\n         6f:ef:eb:52:67:b1:73:de:fc:92:41:9d:f3:e1:87:8e:b4:41:\n         9a:3e:5d:a7:21:c1:de:42:8e:65:1f:9a:c1:86:07:9d:38:9f:\n         81:8e:aa:a5:57:1b:0e:c6:c8:55:4c:a2:9b:34:f5:99:3f:bf:\n         bb:69:4d:d7:39:93:13:bd\n-----BEGIN CERTIFICATE-----\nMIIEqjCCApICFCitdxF1rpON6qJfvzPiJCjcKMDoMA0GCSqGSIb3DQEBCwUAMBMx\nETAPBgNVBAMMCHBvc3RncmVzMB4XDTIyMDIxMTExNTExNFoXDTIzMDIxMTExNTEx\nNFowEDEOMAwGA1UEAwwFZmVuaXgwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK\nAoICAQCyhyO4rJPJE8wtToDzBwZYXdX/l2SJNHWExYSALQpFJoimG0GsgKHqfi9m\n5Om9HxIQWFBLIC6RiOfqlBV+a5tRMLm2nPedRDVlOWUUILUktFUTjkAyrl+EFYqm\npMhSf9G7BQDA+QIj69ZPo5aUM3uzmhWWgycd1uZCqmhSKNrdtRToP/0ckl8Q9BjL\n0sNXh7wUiRQn5hVblvMXzqPGYAdJFqquS+fTvv/kPaxbW27lrWxsyJUJw1HaShXG\nk3BMsPhTYALw0SMDuuTjUBT2HYTlE1KBL9D1f5DxlP+hEWq4T+JwFtDLewQuItvA\nhwhfu/wsjgkIJ7mrQCAyL8rxUQLuVnbBMDtvJ+8iSM1uZCkx1dRL1J2f48FTVLfV\nkBzORTxxf3YwsOkOsWkXQTu3MFNZeSCFnYBWz1WtSnj1E87Q7dsOs15mIbTe4B3i\nUj09wnRS+ngLdVBs29ad6EdreHj+yzs7WXxrtxpValJ3TYQ0ZHK23jDivPioTPfo\nP+Q6Ow+nykNzCUBcx17aSfeyPmOBbMIeOEgLUVTHdRndqZWS2tjYShHxXG+/VdJf\n70LExX54P9UcW7gO13xR/DnBTGNRfOBprJLFup5/X7moSayptSnu/mLoH8jllmfk\naYWLu5LbdJVqrjj+o2HDA1J8ow/443IQOm+bCHKkL38pnGFNoQIDAQABMA0GCSqG\nSIb3DQEBCwUAA4ICAQA8LKQ/NLWnF6lrjjUI24KRCxMJX9dtO7raUwpYhF3oRe0h\n6/N5iDE83BsC9jQRb/2OHKKeFEEEGg4jSQSld6MR9oo4GWPIhib+po1IN9gWGbtq\nsVExPPm9PX6v1j1+zaqp6JzsW9eyI1X6z9a8Iz4cCDl6tTa3OcoH0G419bcqRi9i\nKLUSygZ/B7yrn9fDWdPrMYtGVFsdeFx5XlNUp7hgpp4bRD8ydvgSuPT53TIuDg7i\nTwxQx1zcqkL4Dbk7NLGt3EV+M4BMU0/snTYvcwaq/fFEwj8fHztT80Dy9XbcB7pQ\nlufl8WeBp1aPTY5eWbhYEErh5DSLtypFf+T/RDtzHjtkZC0r8OW8lFDO4AVaGkRN\nPY0eDBgTvp2sN71ZoXJT8/k8+k5dNxzqaWgmUmQFdrAs0jDVfZg8W+8YJmnYCr3u\nBPgC92ZbBxS25l/BPYrLwBIVxDOtz2fo8DF3eZB3wF43clvgCL+58wYN7GiDIlDK\nc3ge9JA1MrCvZHu3VERM/nJDEfa2jL6qGV3InXVfl6d/5zYnOZipd9P+vyvbVsII\nrcOmNuCb+kEiRC9VBEa3lyTMUVui7aT53bZUAixCcZZv7+tSZ7Fz3vySQZ3z4YeO\ntEGaPl2nIcHeQo5lH5rBhgedOJ+BjqqlVxsOxshVTKKbNPWZP7+7aU3XOZMTvQ==\n-----END CERTIFICATE-----\n",
					paramSSLKey:      "-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: DES-EDE3-CBC,CB468F1E3982C588\n\n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\n-----END RSA PRIVATE KEY-----\n",
					paramSSLPassword: "1234",
					paramSSLinLine:   "true",
				},
			},
			wantErr: assert.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(
			tt.name, func(t *testing.T) {
				tt.wantErr(
					t, sslClientCertificates(tt.args.tlsConf, tt.args.o),
					fmt.Sprintf("sslClientCertificates(%v, %v)", tt.args.tlsConf, tt.args.o),
				)
			},
		)
	}
}
