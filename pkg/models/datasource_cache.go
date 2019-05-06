package models

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io/ioutil"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type proxyTransportCache struct {
	cache map[int64]cachedTransport
	sync.Mutex
}

type cachedTransport struct {
	updated time.Time

	transport *transportWrapper
}

type transportWrapper struct {
	base                 *http.Transport
	enrichedRoundTripper http.RoundTripper
}

var ptc = proxyTransportCache{
	cache: make(map[int64]cachedTransport),
}

func (ds *DataSource) GetHttpClient() (*http.Client, error) {
	transport, err := ds.GetHttpTransport()

	if err != nil {
		return nil, err
	}

	return &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}, nil
}

func (ds *DataSource) GetHttpTransport() (*transportWrapper, error) {
	ptc.Lock()
	defer ptc.Unlock()

	if t, present := ptc.cache[ds.Id]; present && ds.Updated.Equal(t.updated) {
		return t.transport, nil
	}

	tlsConfig, err := ds.GetTLSConfig()
	if err != nil {
		return nil, err
	}

	tlsConfig.Renegotiation = tls.RenegotiateFreelyAsClient

	baseTransport := &http.Transport{
		TLSClientConfig: tlsConfig,
		Proxy:           http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout:   time.Duration(setting.DataProxyTimeout) * time.Second,
			KeepAlive: 30 * time.Second,
			DualStack: true,
		}).Dial,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	}

	var rt http.RoundTripper = baseTransport
	if ds.BasicAuth {
		rt = util.NewBasicAuthRoundTripper(
			ds.BasicAuthUser,
			ds.BasicAuthPassword,
			ds.JsonData.MustString("basicAuthPasswordFile"),
			rt,
		)
	}
	if ds.JsonData != nil {
		bearerTokenFile := ds.JsonData.MustString("bearerTokenFile")
		if bearerTokenFile != "" {
			rt = util.NewBearerAuthRoundTripper(bearerTokenFile, rt)
		}
	}

	wrappedTransport := &transportWrapper{
		base:                 baseTransport,
		enrichedRoundTripper: rt,
	}

	ptc.cache[ds.Id] = cachedTransport{
		transport: wrappedTransport,
		updated:   ds.Updated,
	}

	return wrappedTransport, nil
}

func (ds *DataSource) GetTLSConfig() (*tls.Config, error) {
	var (
		tlsSkipVerify, tlsClientAuth, tlsAuthWithCACert    bool
		tlsClientCertFile, tlsClientKeyFile, tlsCACertFile string
	)
	if ds.JsonData != nil {
		tlsClientAuth = ds.JsonData.Get("tlsAuth").MustBool(false)
		tlsAuthWithCACert = ds.JsonData.Get("tlsAuthWithCACert").MustBool(false)
		tlsSkipVerify = ds.JsonData.Get("tlsSkipVerify").MustBool(false)
		tlsClientCertFile = ds.JsonData.Get("tlsClientCertFile").MustString("")
		tlsClientKeyFile = ds.JsonData.Get("tlsClientKeyFile").MustString("")
		tlsCACertFile = ds.JsonData.Get("tlsCACertFile").MustString("")
	}

	tlsConfig := &tls.Config{
		InsecureSkipVerify: tlsSkipVerify,
	}

	if tlsClientAuth || tlsAuthWithCACert {
		decrypted := ds.SecureJsonData.Decrypt()
		if tlsAuthWithCACert {
			var caCert []byte
			var err error
			if tlsCACertFile != "" {
				caCert, err = ioutil.ReadFile(tlsCACertFile)
				if err != nil {
					return nil, err
				}
			} else if len(decrypted["tlsCACert"]) > 0 {
				caCert = []byte(decrypted["tlsCACert"])
			}
			caPool := x509.NewCertPool()
			ok := caPool.AppendCertsFromPEM(caCert)
			if !ok {
				return nil, errors.New("Failed to parse TLS CA PEM certificate")
			}
			tlsConfig.RootCAs = caPool
		}

		if tlsClientAuth {
			var clientCert, clientKey []byte
			var err error
			if tlsClientCertFile != "" && tlsClientKeyFile != "" {
				clientCert, err = ioutil.ReadFile(tlsClientCertFile)
				if err != nil {
					return nil, err
				}
				clientKey, err = ioutil.ReadFile(tlsClientKeyFile)
				if err != nil {
					return nil, err
				}
			} else {
				clientCert = []byte(decrypted["tlsClientCert"])
				clientKey = []byte(decrypted["tlsClientKey"])
			}
			cert, err := tls.X509KeyPair(clientCert, clientKey)
			if err != nil {
				return nil, err
			}
			tlsConfig.Certificates = []tls.Certificate{cert}
		}
	}

	return tlsConfig, nil
}

// RoundTrip implements http.RoundTripper.
func (tw *transportWrapper) RoundTrip(req *http.Request) (*http.Response, error) {
	return tw.enrichedRoundTripper.RoundTrip(req)
}
