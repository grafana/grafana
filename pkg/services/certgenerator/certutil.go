package certgenerator

import (
	"bytes"
	cryptorand "crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"io/fs"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	certutil "k8s.io/client-go/util/cert"
	"k8s.io/client-go/util/keyutil"
	"k8s.io/kubernetes/pkg/controlplane"
	netutils "k8s.io/utils/net"
)

const (
	// The CA gets made using a helper in cert package provided in client-go. As such, it picks 0 for the CA serial - hence starting at 1 here.
	ApiServerCertSerial = iota + 1
	AuthnClientCertSerial
	AuthzClientCertSerial
)

const (
	CannotVerifyErrorMessageFragment = "This is usually caused by only half of the keypair left behind on disk." +
		"Try clearing the certs and retry"
)

type CertUtil struct {
	K8sDataPath string
	caKey       *rsa.PrivateKey
	caCert      *x509.Certificate
	caCertPem   []byte
}

func (cu *CertUtil) CACertFile() string {
	return filepath.Join(cu.K8sDataPath, "ca.crt")
}

func (cu *CertUtil) CAKeyFile() string {
	return filepath.Join(cu.K8sDataPath, "ca.key")
}

func (cu *CertUtil) APIServerCertFile() string {
	return filepath.Join(cu.K8sDataPath, "apiserver.crt")
}

func (cu *CertUtil) APIServerKeyFile() string {
	return filepath.Join(cu.K8sDataPath, "apiserver.key")
}

func (cu *CertUtil) K8sAuthnClientCertFile() string {
	return filepath.Join(cu.K8sDataPath, "embedded-k8s-authn-plugin.crt")
}

func (cu *CertUtil) K8sAuthnClientKeyFile() string {
	return filepath.Join(cu.K8sDataPath, "embedded-k8s-authn-plugin.key")
}

func (cu *CertUtil) K8sAuthzClientCertFile() string {
	return filepath.Join(cu.K8sDataPath, "embedded-k8s-authz-plugin.crt")
}

func (cu *CertUtil) K8sAuthzClientKeyFile() string {
	return filepath.Join(cu.K8sDataPath, "embedded-k8s-authz-plugin.key")
}

// Lifted from kube-apiserver package as it's a dependency of external cert generation
// https://github.com/kubernetes/kubernetes/blob/master/cmd/kube-apiserver/app/server.go#L671
func getServiceIPAndRanges(serviceClusterIPRanges string) (net.IP, net.IPNet, net.IPNet, error) {
	serviceClusterIPRangeList := make([]string, 0)
	if serviceClusterIPRanges != "" {
		serviceClusterIPRangeList = strings.Split(serviceClusterIPRanges, ",")
	}

	var apiServerServiceIP net.IP
	var primaryServiceIPRange net.IPNet
	var secondaryServiceIPRange net.IPNet
	var err error
	// nothing provided by user, use default range (only applies to the Primary)
	if len(serviceClusterIPRangeList) == 0 {
		var primaryServiceClusterCIDR net.IPNet
		primaryServiceIPRange, apiServerServiceIP, err = controlplane.ServiceIPRange(primaryServiceClusterCIDR)
		if err != nil {
			return net.IP{}, net.IPNet{}, net.IPNet{}, fmt.Errorf("error determining service IP ranges: %v", err)
		}
		return apiServerServiceIP, primaryServiceIPRange, net.IPNet{}, nil
	}

	_, primaryServiceClusterCIDR, err := netutils.ParseCIDRSloppy(serviceClusterIPRangeList[0])
	if err != nil {
		return net.IP{}, net.IPNet{}, net.IPNet{}, fmt.Errorf("service-cluster-ip-range[0] is not a valid cidr")
	}

	primaryServiceIPRange, apiServerServiceIP, err = controlplane.ServiceIPRange(*primaryServiceClusterCIDR)
	if err != nil {
		return net.IP{}, net.IPNet{}, net.IPNet{}, fmt.Errorf("error determining service IP ranges for primary service cidr: %v", err)
	}

	// user provided at least two entries
	// note: validation asserts that the list is max of two dual stack entries
	if len(serviceClusterIPRangeList) > 1 {
		_, secondaryServiceClusterCIDR, err := netutils.ParseCIDRSloppy(serviceClusterIPRangeList[1])
		if err != nil {
			return net.IP{}, net.IPNet{}, net.IPNet{}, fmt.Errorf("service-cluster-ip-range[1] is not an ip net")
		}
		secondaryServiceIPRange = *secondaryServiceClusterCIDR
	}
	return apiServerServiceIP, primaryServiceIPRange, secondaryServiceIPRange, nil
}

func loadExistingCertPKI(certPath string, keyPath string) (caCert *x509.Certificate, caKey *rsa.PrivateKey, caCertPemBytes []byte, err error) {
	caCertPemBytes, err = os.ReadFile(filepath.Clean(certPath))
	if err != nil {
		err = fmt.Errorf("error reading existing Cert: %s", err.Error())
		return
	}

	caKeyPemBytes, err := os.ReadFile(filepath.Clean(keyPath))
	if err != nil {
		err = fmt.Errorf("error reading existing Key: %s", err.Error())
		return
	}

	certBlock, _ := pem.Decode(caCertPemBytes)

	caCert, err = x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		err = fmt.Errorf("error parsing existing Cert: %s", err.Error())
		return
	}

	keyBlock, _ := pem.Decode(caKeyPemBytes)
	if err != nil {
		err = fmt.Errorf("error parsing existing Key into pem: %s", err.Error())
		return
	}

	caKey, err = x509.ParsePKCS1PrivateKey(keyBlock.Bytes)
	if err != nil {
		err = fmt.Errorf("error parsing existing Key from pem: %s", err.Error())
		return
	}

	caKey.PublicKey = *(caCert.PublicKey.(*rsa.PublicKey))

	return
}

func createNewCACertPKI() (*x509.Certificate, *rsa.PrivateKey, error) {
	caKey, err := rsa.GenerateKey(cryptorand.Reader, 2048)

	if err != nil {
		return nil, nil, err
	}

	caCert, err := certutil.NewSelfSignedCACert(certutil.Config{
		CommonName:   "embedded-apiserver-ca",
		Organization: []string{"Grafana Labs"},
		AltNames: certutil.AltNames{
			DNSNames: []string{"Grafana Embedded API Server CA"},
		},
	}, caKey)

	if err != nil {
		return nil, nil, err
	}

	return caCert, caKey, nil
}

// NOTE: the optional caCerts parameter is useful if you are preparing a server certificate and want to include CA cert in the cert bundle.
// For client certificates, feel free to omit.
func persistCertKeyPairToDisk(cert *x509.Certificate, certPath string, key *rsa.PrivateKey, keyPath string, caCerts ...*x509.Certificate) error {
	keyBuffer := bytes.Buffer{}
	if err := pem.Encode(&keyBuffer, &pem.Block{Type: keyutil.RSAPrivateKeyBlockType, Bytes: x509.MarshalPKCS1PrivateKey(key)}); err != nil {
		return err
	}

	// Generate cert optionally followed by a CA cert
	certBuffer := bytes.Buffer{}
	if err := pem.Encode(&certBuffer, &pem.Block{Type: certutil.CertificateBlockType, Bytes: cert.Raw}); err != nil {
		return err
	}
	for _, caCert := range caCerts {
		if err := pem.Encode(&certBuffer, &pem.Block{Type: certutil.CertificateBlockType, Bytes: caCert.Raw}); err != nil {
			return err
		}
	}

	err := certutil.WriteCert(certPath, certBuffer.Bytes())
	if err != nil {
		return fmt.Errorf("error persisting CA Cert: %s", err.Error())
	}
	err = keyutil.WriteKey(keyPath, keyBuffer.Bytes())
	if err != nil {
		return fmt.Errorf("error persisting CA Key: %s", err.Error())
	}

	return nil
}

func (cu *CertUtil) InitializeCACertPKI() error {
	if err := os.MkdirAll(cu.K8sDataPath, 0755); err != nil && !errors.Is(err, fs.ErrExist) {
		return err
	}
	exists, err := certutil.CanReadCertAndKey(cu.CACertFile(), cu.CAKeyFile())

	if err != nil {
		return fmt.Errorf("error reading existing CA PKI: %s"+
			CannotVerifyErrorMessageFragment, err.Error())
	}

	if exists {
		cu.caCert, cu.caKey, cu.caCertPem, err = loadExistingCertPKI(cu.CACertFile(), cu.CAKeyFile())
		return err
	} else {
		cu.caCert, cu.caKey, err = createNewCACertPKI()
		if err != nil {
			return err
		}

		return persistCertKeyPairToDisk(cu.caCert, cu.CACertFile(), cu.caKey, cu.CAKeyFile())
	}
}

func (cu *CertUtil) CACertPem() []byte {
	// callers must ensure that CertUtil is initialized before calling on this helper
	if cu.caCertPem == nil {
		return nil
	}
	return cu.caCertPem
}

// NOTE: default KeyUsage to check against is x509.ExtKeyUsageServerAuth, for verifying client certificates, override
// the keyUsages parameter appropriately
func verifyCertChain(cert *x509.Certificate, caCert *x509.Certificate, keyUsages ...x509.ExtKeyUsage) error {
	roots := x509.NewCertPool()
	roots.AddCert(caCert)

	chain, err := cert.Verify(x509.VerifyOptions{
		Roots:     roots,
		KeyUsages: keyUsages,
	})

	if len(chain) == 0 {
		err = errors.New("could not determine the chain from CA certificate")
	}

	if err != nil {
		return fmt.Errorf("error verifiing existing cert (subject=%s) for a sanity check: %s "+
			"Did you delete the original CA cert used for issuing it? "+
			"If so, try reseting your PKI to resolve this problem", cert.Subject.CommonName, err.Error())
	}

	return nil
}

func (cu *CertUtil) EnsureApiServerPKI(advertiseAddress string, alternateIP net.IP) error {
	exists, err := certutil.CanReadCertAndKey(cu.APIServerCertFile(), cu.APIServerCertFile())

	if err != nil {
		return fmt.Errorf("error reading existing CA PKI: %s"+
			CannotVerifyErrorMessageFragment, err.Error())
	}

	if exists {
		// Let's verify that the existing cert in fact verifies against existing CA chain
		cert, _, _, err := loadExistingCertPKI(cu.APIServerCertFile(), cu.APIServerKeyFile())
		if err != nil {
			return err
		}
		return verifyCertChain(cert, cu.caCert)
	}

	validFrom := time.Now().Add(-time.Hour) // valid an hour earlier to avoid flakes due to clock skew
	maxAge := time.Hour * 24 * 365          // one year self-signed certs
	alternateIPs := []net.IP{alternateIP}
	alternateDNS := []string{"kubernetes.default.svc", "kubernetes.default", "kubernetes", "host.docker.internal"}

	priv, err := rsa.GenerateKey(cryptorand.Reader, 2048)
	if err != nil {
		return err
	}

	template := x509.Certificate{
		SerialNumber: new(big.Int).SetInt64(ApiServerCertSerial),
		Subject: pkix.Name{
			CommonName: fmt.Sprintf("%s@%d", advertiseAddress, time.Now().Unix()),
		},
		NotBefore: validFrom,
		NotAfter:  validFrom.Add(maxAge),

		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	if ip := netutils.ParseIPSloppy(advertiseAddress); ip != nil {
		template.IPAddresses = append(template.IPAddresses, ip)
	} else {
		template.DNSNames = append(template.DNSNames, advertiseAddress)
	}

	template.IPAddresses = append(template.IPAddresses, alternateIPs...)
	template.DNSNames = append(template.DNSNames, alternateDNS...)

	certDerBytes, err := x509.CreateCertificate(cryptorand.Reader, &template, cu.caCert, &priv.PublicKey, cu.caKey)
	if err != nil {
		return err
	}

	cert, err := x509.ParseCertificate(certDerBytes)
	if err != nil {
		return err
	}

	return persistCertKeyPairToDisk(cert, cu.APIServerCertFile(), priv, cu.APIServerKeyFile(), cu.caCert)
}

func makeClientCert(clientName string, serialNumber *big.Int, caCert *x509.Certificate, caKey *rsa.PrivateKey) (*x509.Certificate, *rsa.PrivateKey, error) {
	validFrom := time.Now().Add(-time.Hour) // valid an hour earlier to avoid flakes due to clock skew
	maxAge := time.Hour * 24 * 365          // one year self-signed certs

	priv, err := rsa.GenerateKey(cryptorand.Reader, 2048)
	if err != nil {
		return nil, nil, err
	}

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName: fmt.Sprintf("%s@%d", clientName, time.Now().Unix()),
		},
		NotBefore: validFrom,
		NotAfter:  validFrom.Add(maxAge),

		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
	}

	certDerBytes, err := x509.CreateCertificate(cryptorand.Reader, &template, caCert, &priv.PublicKey, caKey)
	if err != nil {
		return nil, nil, err
	}

	cert, err := x509.ParseCertificate(certDerBytes)
	if err != nil {
		return nil, nil, err
	}

	return cert, priv, nil
}

func (cu *CertUtil) EnsureAuthzClientPKI() error {
	exists, err := certutil.CanReadCertAndKey(cu.K8sAuthzClientCertFile(), cu.K8sAuthzClientKeyFile())

	if err != nil {
		return fmt.Errorf("error reading existing authz client PKI: %s"+
			CannotVerifyErrorMessageFragment, err.Error())
	}

	if exists {
		// Let's verify that the existing cert in fact verifies against existing CA chain
		cert, _, _, err := loadExistingCertPKI(cu.K8sAuthzClientCertFile(), cu.K8sAuthzClientKeyFile())
		if err != nil {
			return err
		}
		return verifyCertChain(cert, cu.caCert, x509.ExtKeyUsageClientAuth)
	}

	cert, key, err := makeClientCert("grafana-embedded-k8s-authz-plugin", new(big.Int).SetInt64(AuthzClientCertSerial), cu.caCert, cu.caKey)
	if err != nil {
		return fmt.Errorf("error provisioning k8s authz client PKI: %s", err.Error())
	}

	return persistCertKeyPairToDisk(cert, cu.K8sAuthzClientCertFile(), key, cu.K8sAuthzClientKeyFile())
}

func (cu *CertUtil) EnsureAuthnClientPKI() error {
	exists, err := certutil.CanReadCertAndKey(cu.K8sAuthnClientCertFile(), cu.K8sAuthnClientKeyFile())

	if err != nil {
		return fmt.Errorf("error reading existing authn client PKI. %s"+
			CannotVerifyErrorMessageFragment, err.Error())
	}

	if exists {
		// Let's verify that the existing cert in fact verifies against existing CA chain
		cert, _, _, err := loadExistingCertPKI(cu.K8sAuthnClientCertFile(), cu.K8sAuthnClientKeyFile())
		if err != nil {
			return err
		}
		return verifyCertChain(cert, cu.caCert, x509.ExtKeyUsageClientAuth)
	}

	cert, key, err := makeClientCert("grafana-embedded-k8s-authn-plugin", new(big.Int).SetInt64(AuthnClientCertSerial), cu.caCert, cu.caKey)
	if err != nil {
		return fmt.Errorf("error provisioning k8s authz client PKI: %s", err.Error())
	}

	return persistCertKeyPairToDisk(cert, cu.K8sAuthnClientCertFile(), key, cu.K8sAuthnClientKeyFile())
}
