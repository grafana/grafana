package models

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

type proxyTransportCache struct {
	cache map[int64]cachedTransport
	sync.Mutex
}

// dataSourceTransport implements http.RoundTripper (https://golang.org/pkg/net/http/#RoundTripper)
type dataSourceTransport struct {
	headers   map[string]string
	transport *http.Transport
}

// RoundTrip executes a single HTTP transaction, returning a Response for the provided Request.
func (d *dataSourceTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	for key, value := range d.headers {
		req.Header.Set(key, value)
	}

	return d.transport.RoundTrip(req)
}

type cachedTransport struct {
	updated time.Time

	*dataSourceTransport
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
		Timeout:   time.Duration(setting.DataProxyTimeout) * time.Second,
		Transport: transport,
	}, nil
}

func (ds *DataSource) GetHttpTransport() (*dataSourceTransport, error) {
	ptc.Lock()
	defer ptc.Unlock()

	if t, present := ptc.cache[ds.Id]; present && ds.Updated.Equal(t.updated) {
		return t.dataSourceTransport, nil
	}

	tlsConfig, err := ds.GetTLSConfig()
	if err != nil {
		return nil, err
	}

	tlsConfig.Renegotiation = tls.RenegotiateFreelyAsClient

	// Create transport which adds all
	customHeaders := ds.getCustomHeaders()
	transport := &http.Transport{
		TLSClientConfig: tlsConfig,
		Proxy:           http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout:   time.Duration(setting.DataProxyTimeout) * time.Second,
			KeepAlive: 30 * time.Second,
		}).Dial,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	}

	dsTransport := &dataSourceTransport{
		headers:   customHeaders,
		transport: transport,
	}

	ptc.cache[ds.Id] = cachedTransport{
		dataSourceTransport: dsTransport,
		updated:             ds.Updated,
	}

	return dsTransport, nil
}

func (ds *DataSource) GetTLSConfig() (*tls.Config, error) {
	var tlsSkipVerify, tlsClientAuth, tlsAuthWithCACert bool
	if ds.JsonData != nil {
		tlsClientAuth = ds.JsonData.Get("tlsAuth").MustBool(false)
		tlsAuthWithCACert = ds.JsonData.Get("tlsAuthWithCACert").MustBool(false)
		tlsSkipVerify = ds.JsonData.Get("tlsSkipVerify").MustBool(false)
	}

	tlsConfig := &tls.Config{
		InsecureSkipVerify: tlsSkipVerify,
	}

	if tlsClientAuth || tlsAuthWithCACert {
		decrypted := ds.SecureJsonData.Decrypt()
		if tlsAuthWithCACert && len(decrypted["tlsCACert"]) > 0 {
			caPool := x509.NewCertPool()
			ok := caPool.AppendCertsFromPEM([]byte(decrypted["tlsCACert"]))
			if !ok {
				return nil, errors.New("Failed to parse TLS CA PEM certificate")
			}
			tlsConfig.RootCAs = caPool
		}

		if tlsClientAuth {
			cert, err := tls.X509KeyPair([]byte(decrypted["tlsClientCert"]), []byte(decrypted["tlsClientKey"]))
			if err != nil {
				return nil, err
			}
			tlsConfig.Certificates = []tls.Certificate{cert}
		}
	}

	return tlsConfig, nil
}

// getCustomHeaders returns a map with all the to be set headers
// The map key represents the HeaderName and the value represents this header's value
func (ds *DataSource) getCustomHeaders() map[string]string {
	headers := make(map[string]string)
	if ds.JsonData == nil {
		return headers
	}

	decrypted := ds.SecureJsonData.Decrypt()
	index := 1
	for {
		headerNameSuffix := fmt.Sprintf("httpHeaderName%d", index)
		headerValueSuffix := fmt.Sprintf("httpHeaderValue%d", index)

		key := ds.JsonData.Get(headerNameSuffix).MustString()
		if key == "" {
			// No (more) header values are available
			break
		}

		if val, ok := decrypted[headerValueSuffix]; ok {
			headers[key] = val
		}
		index++
	}

	return headers
}

type cachedDecryptedJSON struct {
	updated time.Time
	json    map[string]string
}

type secureJSONDecryptionCache struct {
	cache map[int64]cachedDecryptedJSON
	sync.Mutex
}

var dsDecryptionCache = secureJSONDecryptionCache{
	cache: make(map[int64]cachedDecryptedJSON),
}

// DecryptedValues returns cached decrypted values from secureJsonData.
func (ds *DataSource) DecryptedValues() map[string]string {
	dsDecryptionCache.Lock()
	defer dsDecryptionCache.Unlock()

	if item, present := dsDecryptionCache.cache[ds.Id]; present && ds.Updated.Equal(item.updated) {
		return item.json
	}

	json := ds.SecureJsonData.Decrypt()
	dsDecryptionCache.cache[ds.Id] = cachedDecryptedJSON{
		updated: ds.Updated,
		json:    json,
	}

	return json
}

// DecryptedValue returns cached decrypted value from cached secureJsonData.
func (ds *DataSource) DecryptedValue(key string) (string, bool) {
	value, exists := ds.DecryptedValues()[key]
	return value, exists
}

// ClearDSDecryptionCache clears the datasource decryption cache.
func ClearDSDecryptionCache() {
	dsDecryptionCache.Lock()
	defer dsDecryptionCache.Unlock()

	dsDecryptionCache.cache = make(map[int64]cachedDecryptedJSON)
}
