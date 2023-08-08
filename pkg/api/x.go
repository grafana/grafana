package api

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

// swagger:route GET /x/:search
//
// Fetch things from X Server.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `orgs.quotas:read` and scope `org:id:1` (orgIDScope).
//
// Responses:
// 200: getQuotaResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetXServer(c *contextmodel.ReqContext) response.Response {
	serverUrl := hs.Cfg.XServer
	hc := http.DefaultClient
	req, _ := http.NewRequest(http.MethodGet, serverUrl, nil)
	q := req.URL.Query()
	q.Set("query", c.Query("query"))
	req.URL.RawQuery = q.Encode()
	req.Header.Set("Authorization", "Bearer "+hs.Cfg.XToken)
	res, _ := hc.Do(req)
	if res != nil {
		defer res.Body.Close()
	}
	bodyBytes, _ := io.ReadAll(res.Body)
	var out any
	_ = json.Unmarshal(bodyBytes, &out)
	return response.Respond(res.StatusCode, out)
}
