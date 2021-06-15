package models

import (
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

//nolint:goconst
func TestDataSource_GetHttpTransport(t *testing.T) {
	t.Run("Should use cached proxy", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})

		clearDSProxyCache(t)
		ds := DataSource{
			Id:   1,
			Url:  "http://k8s:8001",
			Type: "Kubernetes",
		}

		rt1, err := ds.GetHTTPTransport(provider)
		require.NoError(t, err)
		require.NotNil(t, rt1)
		tr1 := configuredTransport

		rt2, err := ds.GetHTTPTransport(provider)
		require.NoError(t, err)
		require.NotNil(t, rt2)
		tr2 := configuredTransport

		require.Same(t, tr1, tr2)

		require.False(t, tr1.TLSClientConfig.InsecureSkipVerify)
		require.Empty(t, tr1.TLSClientConfig.Certificates)
		require.Nil(t, tr1.TLSClientConfig.RootCAs)
	})

	t.Run("Should not use cached proxy when datasource updated", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})
		clearDSProxyCache(t)
		setting.SecretKey = "password"

		json := simplejson.New()
		json.Set("tlsAuthWithCACert", true)

		tlsCaCert, err := util.Encrypt([]byte(caCert), "password")
		require.NoError(t, err)
		ds := DataSource{
			Id:             1,
			Url:            "http://k8s:8001",
			Type:           "Kubernetes",
			SecureJsonData: map[string][]byte{"tlsCACert": tlsCaCert},
			Updated:        time.Now().Add(-2 * time.Minute),
		}

		rt1, err := ds.GetHTTPTransport(provider)
		require.NotNil(t, rt1)
		require.NoError(t, err)

		tr1 := configuredTransport

		require.False(t, tr1.TLSClientConfig.InsecureSkipVerify)
		require.Empty(t, tr1.TLSClientConfig.Certificates)
		require.Nil(t, tr1.TLSClientConfig.RootCAs)

		ds.JsonData = nil
		ds.SecureJsonData = map[string][]byte{}
		ds.Updated = time.Now()

		rt2, err := ds.GetHTTPTransport(provider)
		require.NoError(t, err)
		require.NotNil(t, rt2)
		tr2 := configuredTransport

		require.NotSame(t, tr1, tr2)
		require.Nil(t, tr2.TLSClientConfig.RootCAs)
	})

	t.Run("Should set TLS client authentication enabled if configured in JsonData", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})
		clearDSProxyCache(t)
		setting.SecretKey = "password"

		json := simplejson.New()
		json.Set("tlsAuth", true)

		tlsClientCert, err := util.Encrypt([]byte(clientCert), "password")
		require.NoError(t, err)
		tlsClientKey, err := util.Encrypt([]byte(clientKey), "password")
		require.NoError(t, err)

		ds := DataSource{
			Id:       1,
			Url:      "http://k8s:8001",
			Type:     "Kubernetes",
			JsonData: json,
			SecureJsonData: map[string][]byte{
				"tlsClientCert": tlsClientCert,
				"tlsClientKey":  tlsClientKey,
			},
		}

		rt, err := ds.GetHTTPTransport(provider)
		require.NoError(t, err)
		require.NotNil(t, rt)
		tr := configuredTransport

		require.False(t, tr.TLSClientConfig.InsecureSkipVerify)
		require.Len(t, tr.TLSClientConfig.Certificates, 1)
	})

	t.Run("Should set user-supplied TLS CA if configured in JsonData", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})
		clearDSProxyCache(t)
		ClearDSDecryptionCache()
		setting.SecretKey = "password"

		json := simplejson.New()
		json.Set("tlsAuthWithCACert", true)
		json.Set("serverName", "server-name")

		tlsCaCert, err := util.Encrypt([]byte(caCert), "password")
		require.NoError(t, err)

		ds := DataSource{
			Id:       1,
			Url:      "http://k8s:8001",
			Type:     "Kubernetes",
			JsonData: json,
			SecureJsonData: map[string][]byte{
				"tlsCACert": tlsCaCert,
			},
		}

		rt, err := ds.GetHTTPTransport(provider)
		require.NoError(t, err)
		require.NotNil(t, rt)
		tr := configuredTransport

		require.False(t, tr.TLSClientConfig.InsecureSkipVerify)
		require.Len(t, tr.TLSClientConfig.RootCAs.Subjects(), 1)
		require.Equal(t, "server-name", tr.TLSClientConfig.ServerName)
	})

	t.Run("Should set skip TLS verification if configured in JsonData", func(t *testing.T) {
		var configuredTransport *http.Transport
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredTransport = transport
			},
		})
		clearDSProxyCache(t)

		json := simplejson.New()
		json.Set("tlsSkipVerify", true)

		ds := DataSource{
			Id:       1,
			Url:      "http://k8s:8001",
			Type:     "Kubernetes",
			JsonData: json,
		}

		rt1, err := ds.GetHTTPTransport(provider)
		require.NoError(t, err)
		require.NotNil(t, rt1)
		tr1 := configuredTransport

		rt2, err := ds.GetHTTPTransport(provider)
		require.NoError(t, err)
		require.NotNil(t, rt2)
		tr2 := configuredTransport

		require.Same(t, tr1, tr2)
		require.True(t, tr1.TLSClientConfig.InsecureSkipVerify)
	})

	t.Run("Should set custom headers if configured in JsonData", func(t *testing.T) {
		provider := httpclient.NewProvider()
		clearDSProxyCache(t)
		ClearDSDecryptionCache()

		json := simplejson.NewFromAny(map[string]interface{}{
			"httpHeaderName1": "Authorization",
		})
		encryptedData, err := util.Encrypt([]byte(`Bearer xf5yhfkpsnmgo`), setting.SecretKey)
		if err != nil {
			log.Fatal(err.Error())
		}

		ds := DataSource{
			Id:             1,
			Url:            "http://k8s:8001",
			Type:           "Kubernetes",
			JsonData:       json,
			SecureJsonData: map[string][]byte{"httpHeaderValue1": encryptedData},
		}

		headers := getCustomHeaders(json, map[string]string{"httpHeaderValue1": "Bearer xf5yhfkpsnmgo"})
		require.Equal(t, "Bearer xf5yhfkpsnmgo", headers["Authorization"])

		// 1. Start HTTP test server which checks the request headers
		backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") == "Bearer xf5yhfkpsnmgo" {
				w.WriteHeader(200)
				_, err := w.Write([]byte("Ok"))
				require.NoError(t, err)
				return
			}

			w.WriteHeader(403)
			_, err := w.Write([]byte("Invalid bearer token provided"))
			require.NoError(t, err)
		}))
		defer backend.Close()

		// 2. Get HTTP transport from datasource which uses the test server as backend
		ds.Url = backend.URL
		rt, err := ds.GetHTTPTransport(provider)
		require.NoError(t, err)
		require.NotNil(t, rt)

		// 3. Send test request which should have the Authorization header set
		req := httptest.NewRequest("GET", backend.URL+"/test-headers", nil)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := res.Body.Close()
			require.NoError(t, err)
		})
		body, err := ioutil.ReadAll(res.Body)
		require.NoError(t, err)
		bodyStr := string(body)
		require.Equal(t, "Ok", bodyStr)
	})

	t.Run("Should use request timeout if configured in JsonData", func(t *testing.T) {
		provider := httpclient.NewProvider()
		clearDSProxyCache(t)

		json := simplejson.NewFromAny(map[string]interface{}{
			"timeout": 19,
		})
		ds := DataSource{
			Id:       1,
			Url:      "http://k8s:8001",
			Type:     "Kubernetes",
			JsonData: json,
		}

		client, err := ds.GetHTTPClient(provider)
		require.NoError(t, err)
		require.NotNil(t, client)
		require.Equal(t, 19*time.Second, client.Timeout)
	})

	t.Run("Should populate SigV4 options if configured in JsonData", func(t *testing.T) {
		var configuredOpts sdkhttpclient.Options
		provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
			ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
				configuredOpts = opts
			},
		})
		clearDSProxyCache(t)

		json, err := simplejson.NewJson([]byte(`{ "sigV4Auth": true }`))
		require.NoError(t, err)

		ds := DataSource{
			Type:     DS_ES,
			JsonData: json,
		}

		_, err = ds.GetHTTPTransport(provider)
		require.NoError(t, err)
		require.NotNil(t, configuredOpts)
		require.NotNil(t, configuredOpts.SigV4)
		require.Equal(t, "es", configuredOpts.SigV4.Service)
	})
}

func TestDataSource_getTimeout(t *testing.T) {
	setting.DataProxyTimeout = 30
	testCases := []struct {
		jsonData        *simplejson.Json
		expectedTimeout time.Duration
	}{
		{jsonData: simplejson.New(), expectedTimeout: 30 * time.Second},
		{jsonData: simplejson.NewFromAny(map[string]interface{}{"timeout": nil}), expectedTimeout: 30 * time.Second},
		{jsonData: simplejson.NewFromAny(map[string]interface{}{"timeout": 0}), expectedTimeout: 30 * time.Second},
		{jsonData: simplejson.NewFromAny(map[string]interface{}{"timeout": 1}), expectedTimeout: time.Second},
		{jsonData: simplejson.NewFromAny(map[string]interface{}{"timeout": "2"}), expectedTimeout: 2 * time.Second},
	}

	for _, tc := range testCases {
		ds := &DataSource{
			JsonData: tc.jsonData,
		}
		assert.Equal(t, tc.expectedTimeout, ds.getTimeout())
	}
}

func TestDataSource_DecryptedValue(t *testing.T) {
	t.Run("When datasource hasn't been updated, encrypted JSON should be fetched from cache", func(t *testing.T) {
		ClearDSDecryptionCache()

		ds := DataSource{
			Id:       1,
			Type:     DS_INFLUXDB_08,
			JsonData: simplejson.New(),
			User:     "user",
			SecureJsonData: securejsondata.GetEncryptedJsonData(map[string]string{
				"password": "password",
			}),
		}

		// Populate cache
		password, ok := ds.DecryptedValue("password")
		require.True(t, ok)
		require.Equal(t, "password", password)

		ds.SecureJsonData = securejsondata.GetEncryptedJsonData(map[string]string{
			"password": "",
		})

		password, ok = ds.DecryptedValue("password")
		require.True(t, ok)
		require.Equal(t, "password", password)
	})

	t.Run("When datasource is updated, encrypted JSON should not be fetched from cache", func(t *testing.T) {
		ClearDSDecryptionCache()

		ds := DataSource{
			Id:       1,
			Type:     DS_INFLUXDB_08,
			JsonData: simplejson.New(),
			User:     "user",
			SecureJsonData: securejsondata.GetEncryptedJsonData(map[string]string{
				"password": "password",
			}),
		}

		// Populate cache
		password, ok := ds.DecryptedValue("password")
		require.True(t, ok)
		require.Equal(t, "password", password)

		ds.SecureJsonData = securejsondata.GetEncryptedJsonData(map[string]string{
			"password": "",
		})
		ds.Updated = time.Now()

		password, ok = ds.DecryptedValue("password")
		require.True(t, ok)
		require.Empty(t, password)
	})
}

func clearDSProxyCache(t *testing.T) {
	t.Helper()

	ptc.Lock()
	defer ptc.Unlock()

	ptc.cache = make(map[int64]cachedRoundTripper)
}

const caCert string = `-----BEGIN CERTIFICATE-----
MIIDATCCAemgAwIBAgIJAMQ5hC3CPDTeMA0GCSqGSIb3DQEBCwUAMBcxFTATBgNV
BAMMDGNhLWs4cy1zdGhsbTAeFw0xNjEwMjcwODQyMjdaFw00NDAzMTQwODQyMjda
MBcxFTATBgNVBAMMDGNhLWs4cy1zdGhsbTCCASIwDQYJKoZIhvcNAQEBBQADggEP
ADCCAQoCggEBAMLe2AmJ6IleeUt69vgNchOjjmxIIxz5sp1vFu94m1vUip7CqnOg
QkpUsHeBPrGYv8UGloARCL1xEWS+9FVZeXWQoDmbC0SxXhFwRIESNCET7Q8KMi/4
4YPvnMLGZi3Fjwxa8BdUBCN1cx4WEooMVTWXm7RFMtZgDfuOAn3TNXla732sfT/d
1HNFrh48b0wA+HhmA3nXoBnBEblA665hCeo7lIAdRr0zJxJpnFnWXkyTClsAUTMN
iL905LdBiiIRenojipfKXvMz88XSaWTI7JjZYU3BvhyXndkT6f12cef3I96NY3WJ
0uIK4k04WrbzdYXMU3rN6NqlvbHqnI+E7aMCAwEAAaNQME4wHQYDVR0OBBYEFHHx
2+vSPw9bECHj3O51KNo5VdWOMB8GA1UdIwQYMBaAFHHx2+vSPw9bECHj3O51KNo5
VdWOMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAH2eV5NcV3LBJHs9
I+adbiTPg2vyumrGWwy73T0X8Dtchgt8wU7Q9b9Ucg2fOTmSSyS0iMqEu1Yb2ORB
CknM9mixHC9PwEBbkGCom3VVkqdLwSP6gdILZgyLoH4i8sTUz+S1yGPepi+Vzhs7
adOXtryjcGnwft6HdfKPNklMOHFnjw6uqpho54oj/z55jUpicY/8glDHdrr1bh3k
MHuiWLGewHXPvxfG6UoUx1te65IhifVcJGFZDQwfEmhBflfCmtAJlZEsgTLlBBCh
FHoXIyGOdq1chmRVocdGBCF8fUoGIbuF14r53rpvcbEKtKnnP8+96luKAZLq0a4n
3lb92xM=
-----END CERTIFICATE-----`

const clientCert string = `
-----BEGIN CERTIFICATE-----
MIICsjCCAZoCCQCcd8sOfstQLzANBgkqhkiG9w0BAQsFADAXMRUwEwYDVQQDDAxj
YS1rOHMtc3RobG0wHhcNMTYxMTAyMDkyNTE1WhcNMTcxMTAyMDkyNTE1WjAfMR0w
GwYDVQQDDBRhZG0tZGFuaWVsLWs4cy1zdGhsbTCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAOMliaWyNEUJKM37vWCl5bGub3lMicyRAqGQyY/qxD9yKKM2
FbucVcmWmg5vvTqQVl5rlQ+c7GI8OD6ptmFl8a26coEki7bFr8bkpSyBSEc5p27b
Z0ORFSqBHWHQbr9PkxPLYW6T3gZYUtRYv3OQgGxLXlvUh85n/mQfuR3N1FgmShHo
GtAFi/ht6leXa0Ms+jNSDLCmXpJm1GIEqgyKX7K3+g3vzo9coYqXq4XTa8Efs2v8
SCwqWfBC3rHfgs/5DLB8WT4Kul8QzxkytzcaBQfRfzhSV6bkgm7oTzt2/1eRRsf4
YnXzLE9YkCC9sAn+Owzqf+TYC1KRluWDfqqBTJUCAwEAATANBgkqhkiG9w0BAQsF
AAOCAQEAdMsZg6edWGC+xngizn0uamrUg1ViaDqUsz0vpzY5NWLA4MsBc4EtxWRP
ueQvjUimZ3U3+AX0YWNLIrH1FCVos2jdij/xkTUmHcwzr8rQy+B17cFi+a8jtpgw
AU6WWoaAIEhhbWQfth/Diz3mivl1ARB+YqiWca2mjRPLTPcKJEURDVddQ423el0Q
4JNxS5icu7T2zYTYHAo/cT9zVdLZl0xuLxYm3asK1IONJ/evxyVZima3il6MPvhe
58Hwz+m+HdqHxi24b/1J/VKYbISG4huOQCdLzeNXgvwFlGPUmHSnnKo1/KbQDAR5
llG/Sw5+FquFuChaA6l5KWy7F3bQyA==
-----END CERTIFICATE-----`

const clientKey string = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA4yWJpbI0RQkozfu9YKXlsa5veUyJzJECoZDJj+rEP3IoozYV
u5xVyZaaDm+9OpBWXmuVD5zsYjw4Pqm2YWXxrbpygSSLtsWvxuSlLIFIRzmnbttn
Q5EVKoEdYdBuv0+TE8thbpPeBlhS1Fi/c5CAbEteW9SHzmf+ZB+5Hc3UWCZKEega
0AWL+G3qV5drQyz6M1IMsKZekmbUYgSqDIpfsrf6De/Oj1yhiperhdNrwR+za/xI
LCpZ8ELesd+Cz/kMsHxZPgq6XxDPGTK3NxoFB9F/OFJXpuSCbuhPO3b/V5FGx/hi
dfMsT1iQIL2wCf47DOp/5NgLUpGW5YN+qoFMlQIDAQABAoIBAQCzy4u312XeW1Cs
Mx6EuOwmh59/ESFmBkZh4rxZKYgrfE5EWlQ7i5SwG4BX+wR6rbNfy6JSmHDXlTkk
CKvvToVNcW6fYHEivDnVojhIERFIJ4+rhQmpBtcNLOQ3/4cZ8X/GxE6b+3lb5l+x
64mnjPLKRaIr5/+TVuebEy0xNTJmjnJ7yiB2HRz7uXEQaVSk/P7KAkkyl/9J3/LM
8N9AX1w6qDaNQZ4/P0++1H4SQenosM/b/GqGTomarEk/GE0NcB9rzmR9VCXa7FRh
WV5jyt9vUrwIEiK/6nUnOkGO8Ei3kB7Y+e+2m6WdaNoU5RAfqXmXa0Q/a0lLRruf
vTMo2WrBAoGBAPRaK4cx76Q+3SJ/wfznaPsMM06OSR8A3ctKdV+ip/lyKtb1W8Pz
k8MYQDH7GwPtSu5QD8doL00pPjugZL/ba7X9nAsI+pinyEErfnB9y7ORNEjIYYzs
DiqDKup7ANgw1gZvznWvb9Ge0WUSXvWS0pFkgootQAf+RmnnbWGH6l6RAoGBAO35
aGUrLro5u9RD24uSXNU3NmojINIQFK5dHAT3yl0BBYstL43AEsye9lX95uMPTvOQ
Cqcn42Hjp/bSe3n0ObyOZeXVrWcDFAfE0wwB1BkvL1lpgnFO9+VQORlH4w3Ppnpo
jcPkR2TFeDaAYtvckhxe/Bk3OnuFmnsQ3VzM75fFAoGBAI6PvS2XeNU+yA3EtA01
hg5SQ+zlHswz2TMuMeSmJZJnhY78f5mHlwIQOAPxGQXlf/4iP9J7en1uPpzTK3S0
M9duK4hUqMA/w5oiIhbHjf0qDnMYVbG+V1V+SZ+cPBXmCDihKreGr5qBKnHpkfV8
v9WL6o1rcRw4wiQvnaV1gsvBAoGBALtzVTczr6gDKCAIn5wuWy+cQSGTsBunjRLX
xuVm5iEiV+KMYkPvAx/pKzMLP96lRVR3ptyKgAKwl7LFk3u50+zh4gQLr35QH2wL
Lw7rNc3srAhrItPsFzqrWX6/cGuFoKYVS239l/sZzRppQPXcpb7xVvTp2whHcir0
Wtnpl+TdAoGAGqKqo2KU3JoY3IuTDUk1dsNAm8jd9EWDh+s1x4aG4N79mwcss5GD
FF8MbFPneK7xQd8L6HisKUDAUi2NOyynM81LAftPkvN6ZuUVeFDfCL4vCA0HUXLD
+VrOhtUZkNNJlLMiVRJuQKUOGlg8PpObqYbstQAf/0/yFJMRHG82Tcg=
-----END RSA PRIVATE KEY-----`
