package api

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func GraphiteProxy(c *middleware.Context) {
	proxyPath := c.Params("*")
	target, _ := url.Parse(setting.GraphiteUrl)

	// check if this is a special raintank_db requests
	if proxyPath == "metrics/find" {
		query := c.Query("query")
		if strings.HasPrefix(query, "raintank_db") {
			response, err := executeRaintankDbQuery(query, c.OrgId)
			if err != nil {
				c.JsonApiErr(500, "Failed to execute raintank_db query", err)
				return
			}
			c.JSON(200, response)
			return
		}
	}

	director := func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.Header.Add("X-Org-Id", strconv.FormatInt(c.OrgId, 10))
		req.URL.Path = util.JoinUrlFragments(target.Path, proxyPath)

	}

	proxy := &httputil.ReverseProxy{Director: director}

	proxy.ServeHTTP(c.RW(), c.Req.Request)
}

func executeRaintankDbQuery(query string, orgId int64) (interface{}, error) {
	values := []util.DynMap{}

	if query == "raintank_db.tags.collectors.*" {
		tagsQuery := m.GetAllCollectorTagsQuery{OrgId: orgId}
		if err := bus.Dispatch(&tagsQuery); err != nil {
			return nil, err
		}

		for _, tag := range tagsQuery.Result {
			values = append(values, util.DynMap{"text": tag, "expandable": false})
		}
	}
	// regex := regexp.MustCompile(`\${(\w+)}`)
	// return regex.ReplaceAllStringFunc(value, func(envVar string) string {
	// 	envVar = strings.TrimPrefix(envVar, "${")
	// 	envVar = strings.TrimSuffix(envVar, "}")
	// 	envValue := os.Getenv(envVar)
	// 	return envValue
	// })

	// if query == "raintank_db.tags.collectors.*" {
	// 	tagsQuery := m.GetAllCollectorTagsQuery{OrgId: c.OrgId}
	// 	if err := bus.Dispatch(&tagsQuery); err != nil {
	// 		return
	// 	}
	//
	// 	for _, tag := range tagsQuery.Result {
	// 		values = append(values, util.DynMap{"text": tag, "expandable": false})
	// 	}
	// }
	//
	return values, nil
}
