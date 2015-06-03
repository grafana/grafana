package api

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"regexp"
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
	values := []map[string]interface{}{}

	if query == "raintank_db.tags.collectors.*" {
		// return all tags
		tagsQuery := m.GetAllCollectorTagsQuery{OrgId: orgId}
		if err := bus.Dispatch(&tagsQuery); err != nil {
			return nil, err
		}

		for _, tag := range tagsQuery.Result {
			values = append(values, util.DynMap{"text": tag, "expandable": false})
		}

		return values, nil
	}

	regex := regexp.MustCompile(`^raintank_db\.tags\.collectors\.(\w+)\.\*`)
	matches := regex.FindAllStringSubmatch(query, -1)
	key := ""

	if len(matches) == 0 {
		return values, nil
	}

	key = matches[0][1]

	if key != "" {
		// return tag values for key
		collectorsQuery := m.GetCollectorsQuery{OrgId: orgId, Tag: []string{key}}
		if err := bus.Dispatch(&collectorsQuery); err != nil {
			return nil, err
		}

		for _, collector := range collectorsQuery.Result {
			values = append(values, util.DynMap{"text": collector.Slug, "expandable": false})
		}
	}

	return values, nil
}
