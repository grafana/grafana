package pluginproxy

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"testing"
	"time"

	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
)

func TestDSRouteRule(t *testing.T) {

	Convey("DataSourceProxy", t, func() {
		Convey("Plugin with routes", func() {
			plugin := &plugins.DataSourcePlugin{
				Routes: []*plugins.AppPluginRoute{
					{
						Path:    "api/v4/",
						Url:     "https://www.google.com",
						ReqRole: m.ROLE_EDITOR,
						Headers: []plugins.AppPluginRouteHeader{
							{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
						},
					},
					{
						Path:    "api/admin",
						Url:     "https://www.google.com",
						ReqRole: m.ROLE_ADMIN,
						Headers: []plugins.AppPluginRouteHeader{
							{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
						},
					},
					{
						Path: "api/anon",
						Url:  "https://www.google.com",
						Headers: []plugins.AppPluginRouteHeader{
							{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
						},
					},
					{
						Path: "api/common",
						Url:  "{{.JsonData.dynamicUrl}}",
						Headers: []plugins.AppPluginRouteHeader{
							{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
						},
					},
				},
			}

			setting.SecretKey = "password"
			key, _ := util.Encrypt([]byte("123"), "password")

			ds := &m.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"clientId":   "asd",
					"dynamicUrl": "https://dynamic.grafana.com",
				}),
				SecureJsonData: map[string][]byte{
					"key": key,
				},
			}

			req, _ := http.NewRequest("GET", "http://localhost/asd", nil)
			ctx := &m.ReqContext{
				Context: &macaron.Context{
					Req: macaron.Request{Request: req},
				},
				SignedInUser: &m.SignedInUser{OrgRole: m.ROLE_EDITOR},
			}

			Convey("When matching route path", func() {
				proxy := NewDataSourceProxy(ds, plugin, ctx, "api/v4/some/method")
				proxy.route = plugin.Routes[0]
				ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.route, proxy.ds)

				Convey("should add headers and update url", func() {
					So(req.URL.String(), ShouldEqual, "https://www.google.com/some/method")
					So(req.Header.Get("x-header"), ShouldEqual, "my secret 123")
				})
			})

			Convey("When matching route path and has dynamic url", func() {
				proxy := NewDataSourceProxy(ds, plugin, ctx, "api/common/some/method")
				proxy.route = plugin.Routes[3]
				ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.route, proxy.ds)

				Convey("should add headers and interpolate the url", func() {
					So(req.URL.String(), ShouldEqual, "https://dynamic.grafana.com/some/method")
					So(req.Header.Get("x-header"), ShouldEqual, "my secret 123")
				})
			})

			Convey("Validating request", func() {
				Convey("plugin route with valid role", func() {
					proxy := NewDataSourceProxy(ds, plugin, ctx, "api/v4/some/method")
					err := proxy.validateRequest()
					So(err, ShouldBeNil)
				})

				Convey("plugin route with admin role and user is editor", func() {
					proxy := NewDataSourceProxy(ds, plugin, ctx, "api/admin")
					err := proxy.validateRequest()
					So(err, ShouldNotBeNil)
				})

				Convey("plugin route with admin role and user is admin", func() {
					ctx.SignedInUser.OrgRole = m.ROLE_ADMIN
					proxy := NewDataSourceProxy(ds, plugin, ctx, "api/admin")
					err := proxy.validateRequest()
					So(err, ShouldBeNil)
				})
			})
		})

		Convey("Plugin with multiple routes for token auth", func() {
			plugin := &plugins.DataSourcePlugin{
				Routes: []*plugins.AppPluginRoute{
					{
						Path: "pathwithtoken1",
						Url:  "https://api.nr1.io/some/path",
						TokenAuth: &plugins.JwtTokenAuth{
							Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
							Params: map[string]string{
								"grant_type":    "client_credentials",
								"client_id":     "{{.JsonData.clientId}}",
								"client_secret": "{{.SecureJsonData.clientSecret}}",
								"resource":      "https://api.nr1.io",
							},
						},
					},
					{
						Path: "pathwithtoken2",
						Url:  "https://api.nr2.io/some/path",
						TokenAuth: &plugins.JwtTokenAuth{
							Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
							Params: map[string]string{
								"grant_type":    "client_credentials",
								"client_id":     "{{.JsonData.clientId}}",
								"client_secret": "{{.SecureJsonData.clientSecret}}",
								"resource":      "https://api.nr2.io",
							},
						},
					},
				},
			}

			setting.SecretKey = "password"
			key, _ := util.Encrypt([]byte("123"), "password")

			ds := &m.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"clientId": "asd",
					"tenantId": "mytenantId",
				}),
				SecureJsonData: map[string][]byte{
					"clientSecret": key,
				},
			}

			req, _ := http.NewRequest("GET", "http://localhost/asd", nil)
			ctx := &m.ReqContext{
				Context: &macaron.Context{
					Req: macaron.Request{Request: req},
				},
				SignedInUser: &m.SignedInUser{OrgRole: m.ROLE_EDITOR},
			}

			Convey("When creating and caching access tokens", func() {
				var authorizationHeaderCall1 string
				var authorizationHeaderCall2 string

				Convey("first call should add authorization header with access token", func() {
					json, err := ioutil.ReadFile("./test-data/access-token-1.json")
					So(err, ShouldBeNil)

					client = newFakeHTTPClient(json)
					proxy1 := NewDataSourceProxy(ds, plugin, ctx, "pathwithtoken1")
					proxy1.route = plugin.Routes[0]
					ApplyRoute(proxy1.ctx.Req.Context(), req, proxy1.proxyPath, proxy1.route, proxy1.ds)

					authorizationHeaderCall1 = req.Header.Get("Authorization")
					So(req.URL.String(), ShouldEqual, "https://api.nr1.io/some/path")
					So(authorizationHeaderCall1, ShouldStartWith, "Bearer eyJ0e")

					Convey("second call to another route should add a different access token", func() {
						json2, err := ioutil.ReadFile("./test-data/access-token-2.json")
						So(err, ShouldBeNil)

						req, _ := http.NewRequest("GET", "http://localhost/asd", nil)
						client = newFakeHTTPClient(json2)
						proxy2 := NewDataSourceProxy(ds, plugin, ctx, "pathwithtoken2")
						proxy2.route = plugin.Routes[1]
						ApplyRoute(proxy2.ctx.Req.Context(), req, proxy2.proxyPath, proxy2.route, proxy2.ds)

						authorizationHeaderCall2 = req.Header.Get("Authorization")

						So(req.URL.String(), ShouldEqual, "https://api.nr2.io/some/path")
						So(authorizationHeaderCall1, ShouldStartWith, "Bearer eyJ0e")
						So(authorizationHeaderCall2, ShouldStartWith, "Bearer eyJ0e")
						So(authorizationHeaderCall2, ShouldNotEqual, authorizationHeaderCall1)

						Convey("third call to first route should add cached access token", func() {
							req, _ := http.NewRequest("GET", "http://localhost/asd", nil)

							client = newFakeHTTPClient([]byte{})
							proxy3 := NewDataSourceProxy(ds, plugin, ctx, "pathwithtoken1")
							proxy3.route = plugin.Routes[0]
							ApplyRoute(proxy3.ctx.Req.Context(), req, proxy3.proxyPath, proxy3.route, proxy3.ds)

							authorizationHeaderCall3 := req.Header.Get("Authorization")
							So(req.URL.String(), ShouldEqual, "https://api.nr1.io/some/path")
							So(authorizationHeaderCall1, ShouldStartWith, "Bearer eyJ0e")
							So(authorizationHeaderCall3, ShouldStartWith, "Bearer eyJ0e")
							So(authorizationHeaderCall3, ShouldEqual, authorizationHeaderCall1)
						})
					})
				})
			})
		})

		Convey("When proxying graphite", func() {
			setting.BuildVersion = "5.3.0"
			plugin := &plugins.DataSourcePlugin{}
			ds := &m.DataSource{Url: "htttp://graphite:8080", Type: m.DS_GRAPHITE}
			ctx := &m.ReqContext{}

			proxy := NewDataSourceProxy(ds, plugin, ctx, "/render")
			req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
			So(err, ShouldBeNil)

			proxy.getDirector()(req)

			Convey("Can translate request url and path", func() {
				So(req.URL.Host, ShouldEqual, "graphite:8080")
				So(req.URL.Path, ShouldEqual, "/render")
				So(req.Header.Get("User-Agent"), ShouldEqual, "Grafana/5.3.0")
			})
		})

		Convey("When proxying InfluxDB", func() {
			plugin := &plugins.DataSourcePlugin{}

			ds := &m.DataSource{
				Type:     m.DS_INFLUXDB_08,
				Url:      "http://influxdb:8083",
				Database: "site",
				User:     "user",
				Password: "password",
			}

			ctx := &m.ReqContext{}
			proxy := NewDataSourceProxy(ds, plugin, ctx, "")

			req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
			So(err, ShouldBeNil)

			proxy.getDirector()(req)

			Convey("Should add db to url", func() {
				So(req.URL.Path, ShouldEqual, "/db/site/")
			})

			Convey("Should add username and password", func() {
				queryVals := req.URL.Query()
				So(queryVals["u"][0], ShouldEqual, "user")
				So(queryVals["p"][0], ShouldEqual, "password")
			})
		})

		Convey("When proxying a data source with no keepCookies specified", func() {
			plugin := &plugins.DataSourcePlugin{}

			json, _ := simplejson.NewJson([]byte(`{"keepCookies": []}`))

			ds := &m.DataSource{
				Type:     m.DS_GRAPHITE,
				Url:      "http://graphite:8086",
				JsonData: json,
			}

			ctx := &m.ReqContext{}
			proxy := NewDataSourceProxy(ds, plugin, ctx, "")

			requestURL, _ := url.Parse("http://grafana.com/sub")
			req := http.Request{URL: requestURL, Header: make(http.Header)}
			cookies := "grafana_user=admin; grafana_remember=99; grafana_sess=11; JSESSION_ID=test"
			req.Header.Set("Cookie", cookies)

			proxy.getDirector()(&req)

			Convey("Should clear all cookies", func() {
				So(req.Header.Get("Cookie"), ShouldEqual, "")
			})
		})

		Convey("When proxying a data source with keep cookies specified", func() {
			plugin := &plugins.DataSourcePlugin{}

			json, _ := simplejson.NewJson([]byte(`{"keepCookies": ["JSESSION_ID"]}`))

			ds := &m.DataSource{
				Type:     m.DS_GRAPHITE,
				Url:      "http://graphite:8086",
				JsonData: json,
			}

			ctx := &m.ReqContext{}
			proxy := NewDataSourceProxy(ds, plugin, ctx, "")

			requestURL, _ := url.Parse("http://grafana.com/sub")
			req := http.Request{URL: requestURL, Header: make(http.Header)}
			cookies := "grafana_user=admin; grafana_remember=99; grafana_sess=11; JSESSION_ID=test"
			req.Header.Set("Cookie", cookies)

			proxy.getDirector()(&req)

			Convey("Should keep named cookies", func() {
				So(req.Header.Get("Cookie"), ShouldEqual, "JSESSION_ID=test")
			})
		})

		Convey("When proxying a data source with custom headers specified", func() {
			plugin := &plugins.DataSourcePlugin{}

			encryptedData, err := util.Encrypt([]byte(`Bearer xf5yhfkpsnmgo`), setting.SecretKey)
			ds := &m.DataSource{
				Type: m.DS_PROMETHEUS,
				Url:  "http://prometheus:9090",
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"httpHeaderName1": "Authorization",
				}),
				SecureJsonData: map[string][]byte{
					"httpHeaderValue1": encryptedData,
				},
			}

			ctx := &m.ReqContext{}
			proxy := NewDataSourceProxy(ds, plugin, ctx, "")

			requestURL, _ := url.Parse("http://grafana.com/sub")
			req := http.Request{URL: requestURL, Header: make(http.Header)}
			proxy.getDirector()(&req)

			if err != nil {
				log.Fatal(4, err.Error())
			}

			Convey("Match header value after decryption", func() {
				So(req.Header.Get("Authorization"), ShouldEqual, "Bearer xf5yhfkpsnmgo")
			})
		})

		Convey("When proxying a custom datasource", func() {
			plugin := &plugins.DataSourcePlugin{}
			ds := &m.DataSource{
				Type: "custom-datasource",
				Url:  "http://host/root/",
			}
			ctx := &m.ReqContext{}
			proxy := NewDataSourceProxy(ds, plugin, ctx, "/path/to/folder/")
			req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
			So(err, ShouldBeNil)

			proxy.getDirector()(req)

			Convey("Shoudl keep user request (including trailing slash)", func() {
				So(req.URL.String(), ShouldEqual, "http://host/root/path/to/folder/")
			})
		})
	})
}

type httpClientStub struct {
	fakeBody []byte
}

func (c *httpClientStub) Do(req *http.Request) (*http.Response, error) {
	bodyJSON, _ := simplejson.NewJson(c.fakeBody)
	_, passedTokenCacheTest := bodyJSON.CheckGet("expires_on")
	So(passedTokenCacheTest, ShouldBeTrue)

	bodyJSON.Set("expires_on", fmt.Sprint(time.Now().Add(time.Second*60).Unix()))
	body, _ := bodyJSON.MarshalJSON()
	resp := &http.Response{
		Body: ioutil.NopCloser(bytes.NewReader(body)),
	}

	return resp, nil
}

func newFakeHTTPClient(fakeBody []byte) httpClient {
	return &httpClientStub{
		fakeBody: fakeBody,
	}
}
