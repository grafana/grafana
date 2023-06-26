/*
Copyright 2014 The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// a part of cert util from https://github.com/kubernetes/client-go/tree/master/util/cert copied here
// without modifications. This is to remove dependencies on client-go for this largely independent
// piece around cert generation.

package certgenerator

import (
	"crypto"
	cryptorand "crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"net"
	"time"
)

const (
	// CertificateBlockType is a possible value for pem.Block.Type.
	CertificateBlockType = "CERTIFICATE"
)

const duration365d = time.Hour * 24 * 365

// Config contains the basic fields required for creating a certificate
type Config struct {
	CommonName   string
	Organization []string
	AltNames     AltNames
	Usages       []x509.ExtKeyUsage
}

// AltNames contains the domain names and IP addresses that will be added
// to the API Server's x509 certificate SubAltNames field. The values will
// be passed directly to the x509.Certificate object.
type AltNames struct {
	DNSNames []string
	IPs      []net.IP
}

// NewSelfSignedCACert creates a CA certificate
func NewSelfSignedCACert(cfg Config, key crypto.Signer) (*x509.Certificate, error) {
	now := time.Now()
	tmpl := x509.Certificate{
		SerialNumber: new(big.Int).SetInt64(0),
		Subject: pkix.Name{
			CommonName:   cfg.CommonName,
			Organization: cfg.Organization,
		},
		DNSNames:              []string{cfg.CommonName},
		NotBefore:             now.UTC(),
		NotAfter:              now.Add(duration365d * 10).UTC(),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}

	certDERBytes, err := x509.CreateCertificate(cryptorand.Reader, &tmpl, &tmpl, key.Public(), key)
	if err != nil {
		return nil, err
	}
	return x509.ParseCertificate(certDERBytes)
}
