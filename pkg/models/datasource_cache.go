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
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var datasourceRequestCounter = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "datasource_request_total",
		Help:      "A counter for outgoing requests for a datasource",
	},
	[]string{"datasource", "code", "method"},
)

var datasourceRequestSummary = prometheus.NewSummaryVec(
	prometheus.SummaryOpts{
		Namespace:  "grafana",
		Name:       "datasource_request_duration_seconds",
		Help:       "summary of outgoing datasource requests sent from Grafana",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	}, []string{"datasource", "code", "method"},
)

var datasourceResponseSummary = prometheus.NewSummaryVec(
	prometheus.SummaryOpts{
		Namespace:  "grafana",
		Name:       "datasource_response_size_bytes",
		Help:       "summary of datasource response sizes returned to Grafana",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	}, []string{"datasource"},
)

var datasourceRequestsInFlight = prometheus.NewGaugeVec(
	prometheus.GaugeOpts{
		Namespace: "grafana",
		Name:      "datasource_request_in_flight",
		Help:      "A gauge of outgoing datasource requests currently being sent by Grafana",
	},
	[]string{"datasource"},
)

func init() {
	prometheus.MustRegister(datasourceRequestSummary,
		datasourceRequestCounter,
		datasourceRequestsInFlight,
		datasourceResponseSummary)
}

type proxyTransportCache struct {
	cache map[int64]cachedTransport
	sync.Mutex
}

// dataSourceTransport implements http.RoundTripper (https://golang.org/pkg/net/http/#RoundTripper)
type dataSourceTransport struct {
	datasourceName string
	headers        map[string]string
	transport      *http.Transport
}

func instrumentRoundtrip(datasourceName string, next http.RoundTripper) promhttp.RoundTripperFunc {
	return promhttp.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
		datasourceLabel := prometheus.Labels{"datasource": datasourceName}

		requestCounter := datasourceRequestCounter.MustCurryWith(datasourceLabel)
		requestSummary := datasourceRequestSummary.MustCurryWith(datasourceLabel)
		requestInFlight := datasourceRequestsInFlight.With(datasourceLabel)
		responseSizeSummary := datasourceResponseSummary.With(datasourceLabel)

		res, err := promhttp.InstrumentRoundTripperDuration(requestSummary,
			promhttp.InstrumentRoundTripperCounter(requestCounter,
				promhttp.InstrumentRoundTripperInFlight(requestInFlight, next))).
			RoundTrip(r)

		// we avoid measuring contentlength less than zero because it indicates
		// that the content size is unknown. https://godoc.org/github.com/badu/http#Response
		if res != nil && res.ContentLength > 0 {
			responseSizeSummary.Observe(float64(res.ContentLength))
		}

		return res, err
	})
}

// RoundTrip executes a single HTTP transaction, returning a Response for the provided Request.
func (d *dataSourceTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	for key, value := range d.headers {
		req.Header.Set(key, value)
	}

	return instrumentRoundtrip(d.datasourceName, d.transport).RoundTrip(req)
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
		headers:        customHeaders,
		transport:      transport,
		datasourceName: ds.Name,
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
