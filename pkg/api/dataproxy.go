package api

import (
	"crypto/tls"
	"crypto/x509"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/cloudwatch"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type proxyTransportCache struct {
	cache map[int64]cachedTransport
	sync.Mutex
}

type cachedTransport struct {
	updated time.Time

	*http.Transport
}

var ptc = proxyTransportCache{
	cache: make(map[int64]cachedTransport),
}

func DataProxyTransport(ds *m.DataSource) (*http.Transport, error) {
	ptc.Lock()
	defer ptc.Unlock()

	if t, present := ptc.cache[ds.Id]; present && ds.Updated.Equal(t.updated) {
		return t.Transport, nil
	}

	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
		Proxy: http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).Dial,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	var tlsAuth, tlsAuthWithCACert bool
	if ds.JsonData != nil {
		tlsAuth = ds.JsonData.Get("tlsAuth").MustBool(false)
		tlsAuthWithCACert = ds.JsonData.Get("tlsAuthWithCACert").MustBool(false)
	}

	if tlsAuth {
		transport.TLSClientConfig.InsecureSkipVerify = false

		decrypted := ds.SecureJsonData.Decrypt()

		if tlsAuthWithCACert && len(decrypted["tlsCACert"]) > 0 {
			caPool := x509.NewCertPool()
			ok := caPool.AppendCertsFromPEM([]byte(decrypted["tlsCACert"]))
			if ok {
				transport.TLSClientConfig.RootCAs = caPool
			}
		}

		cert, err := tls.X509KeyPair([]byte(decrypted["tlsClientCert"]), []byte(decrypted["tlsClientKey"]))
		if err != nil {
			return nil, err
		}
		transport.TLSClientConfig.Certificates = []tls.Certificate{cert}
	}

	ptc.cache[ds.Id] = cachedTransport{
		Transport: transport,
		updated:   ds.Updated,
	}

	return transport, nil
}

func NewReverseProxy(ds *m.DataSource, proxyPath string, targetUrl *url.URL) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = targetUrl.Scheme
		req.URL.Host = targetUrl.Host
		req.Host = targetUrl.Host

		reqQueryVals := req.URL.Query()

		if ds.Type == m.DS_INFLUXDB_08 {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, "db/"+ds.Database+"/"+proxyPath)
			reqQueryVals.Add("u", ds.User)
			reqQueryVals.Add("p", ds.Password)
			req.URL.RawQuery = reqQueryVals.Encode()
		} else if ds.Type == m.DS_INFLUXDB {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)
			req.URL.RawQuery = reqQueryVals.Encode()
			if !ds.BasicAuth {
				req.Header.Del("Authorization")
				req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.User, ds.Password))
			}
		} else {
			req.URL.Path = util.JoinUrlFragments(targetUrl.Path, proxyPath)
		}

		if ds.BasicAuth {
			req.Header.Del("Authorization")
			req.Header.Add("Authorization", util.GetBasicAuthHeader(ds.BasicAuthUser, ds.BasicAuthPassword))
		}

		dsAuth := req.Header.Get("X-DS-Authorization")
		if len(dsAuth) > 0 {
			req.Header.Del("X-DS-Authorization")
			req.Header.Del("Authorization")
			req.Header.Add("Authorization", dsAuth)
		}

		// clear cookie headers
		req.Header.Del("Cookie")
		req.Header.Del("Set-Cookie")
	}

	return &httputil.ReverseProxy{Director: director, FlushInterval: time.Millisecond * 200}
}

func getDatasource(id int64, orgId int64) (*m.DataSource, error) {
	query := m.GetDataSourceByIdQuery{Id: id, OrgId: orgId}
	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

func ProxyDataSourceRequest(c *middleware.Context) {
	c.TimeRequest(metrics.M_DataSource_ProxyReq_Timer)

	ds, err := getDatasource(c.ParamsInt64(":id"), c.OrgId)

	if err != nil {
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

	if ds.Type == m.DS_CLOUDWATCH {
		cloudwatch.HandleRequest(c, ds)
		return
	}

	if ds.Type == m.DS_INFLUXDB {
		if c.Query("db") != ds.Database {
			c.JsonApiErr(403, "Datasource is not configured to allow this database", nil)
			return
		}
	}

	targetUrl, _ := url.Parse(ds.Url)
	if len(setting.DataProxyWhiteList) > 0 {
		if _, exists := setting.DataProxyWhiteList[targetUrl.Host]; !exists {
			c.JsonApiErr(403, "Data proxy hostname and ip are not included in whitelist", nil)
			return
		}
	}

	proxyPath := c.Params("*")

	if ds.Type == m.DS_ES {
		if c.Req.Request.Method == "DELETE" {
			c.JsonApiErr(403, "Deletes not allowed on proxied Elasticsearch datasource", nil)
			return
		}
		if c.Req.Request.Method == "PUT" {
			c.JsonApiErr(403, "Puts not allowed on proxied Elasticsearch datasource", nil)
			return
		}
		if c.Req.Request.Method == "POST" && proxyPath != "_msearch" {
			c.JsonApiErr(403, "Posts not allowed on proxied Elasticsearch datasource except on /_msearch", nil)
			return
		}
	}

	proxy := NewReverseProxy(ds, proxyPath, targetUrl)
	proxy.Transport, err = DataProxyTransport(ds)
	if err != nil {
		c.JsonApiErr(400, "Unable to load TLS certificate", err)
		return
	}
	proxy.ServeHTTP(c.Resp, c.Req.Request)
	c.Resp.Header().Del("Set-Cookie")
}
