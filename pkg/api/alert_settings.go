package api

import (
	"github.com/wangy1931/grafana/pkg/middleware"
  "github.com/wangy1931/grafana/pkg/setting"
  "github.com/wangy1931/grafana/pkg/log"
  "net/url"
  "net/http/httputil"
  "github.com/wangy1931/grafana/pkg/util"
  "net/http"
  "strconv"
)

func GetAlertSource(c *middleware.Context) {
  log.Info("Alert Url: %v", setting.Alert.AlertUrlRoot)

  alert := make(map[string]interface{})
  jsonAlertUrl := make(map[string]interface{})
  jsonAlertUrl["alert_urlroot"] = setting.Alert.AlertUrlRoot
  alert["alert"] = jsonAlertUrl

  c.JSON(200, alert)
}

func ProxyAlertDataSourceRequest(c *middleware.Context) {
  targetUrl, _ := url.Parse(setting.Alert.AlertUrlRoot)
  director := func(req *http.Request) {
    req.URL.Scheme = targetUrl.Scheme
    req.URL.Host = targetUrl.Host
    req.Host = targetUrl.Host

    reqQueryVals := req.URL.Query()
    reqQueryVals.Add("org", strconv.FormatInt(c.OrgId, 10))
    req.URL.RawQuery = reqQueryVals.Encode()
    req.URL.Path = util.JoinUrlFragments(targetUrl.Path, "/healthsummary")
    // clear cookie headers
    req.Header.Del("Cookie")
    req.Header.Del("Set-Cookie")
  }

  proxy :=&httputil.ReverseProxy{Director: director}
  proxy.Transport = dataProxyTransport
  proxy.ServeHTTP(c.RW(), c.Req.Request)
}
/*
func GetAlertSource(c *middleware.Context) {
	query := m.GetAlertSourceQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to query alert source", err)
		return
	}

  ds := query.Result

  c.JSON(200, &dtos.AlertSource{
    OrgId:             ds.OrgId,
    Url:               ds.Url,
  })

}
*/
