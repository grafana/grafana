package sqlstore

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
)

func makeCert(tlsPoolName string, config MySQLConfig) (*tls.Config, error) {
	rootCertPool := x509.NewCertPool()
	pem, err := ioutil.ReadFile(config.CaCertPath)
	if err != nil {
		return nil, fmt.Errorf("Could not read DB CA Cert path: %v", config.CaCertPath)
	}
	if ok := rootCertPool.AppendCertsFromPEM(pem); !ok {
		return nil, err
	}
	clientCert := make([]tls.Certificate, 0, 1)
	if (config.ClientCertPath != "" && config.ClientKeyPath != "") {

		certs, err := tls.LoadX509KeyPair(config.ClientCertPath, config.ClientKeyPath)
		if err != nil {
			return nil, err
		}
		clientCert = append(clientCert, certs)
	}
	tlsConfig := &tls.Config{
		RootCAs:      rootCertPool,
		Certificates: clientCert,
	}
	tlsConfig.ServerName = config.ServerCertName
	if config.SslMode == "skip-verify" {
		tlsConfig.InsecureSkipVerify = true
	}
	// Return more meaningful error before it is too late
	if config.ServerCertName == "" && !tlsConfig.InsecureSkipVerify{
		return nil, fmt.Errorf("server_cert_name is missing. Consider using ssl_mode = skip-verify.")
	}
	return tlsConfig, nil
}
