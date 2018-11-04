package api

import (
	"fmt"
	"github.com/pkg/errors"
	"time"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

const HeaderNameNoBackendCache = "X-Grafana-NoCache"

func (hs *HTTPServer) getDatasourceFromCache(id int64, c *m.ReqContext) (*m.DataSource, error) {
	userPermissionsQuery := m.GetDataSourcePermissionsForUserQuery{
		User: c.SignedInUser,
	}
	if err := bus.Dispatch(&userPermissionsQuery); err != nil {
		if err != bus.ErrHandlerNotFound {
			return nil, err
		}
	} else {
		permissionType, exists := userPermissionsQuery.Result[id]
		if exists && permissionType != m.DsPermissionQuery {
			return nil, errors.New("User not allowed to access datasource")
		}
	}

	nocache := c.Req.Header.Get(HeaderNameNoBackendCache) == "true"
	cacheKey := fmt.Sprintf("ds-%d", id)

	if !nocache {
		if cached, found := hs.cache.Get(cacheKey); found {
			ds := cached.(*m.DataSource)
			if ds.OrgId == c.OrgId {
				return ds, nil
			}
		}
	}

	query := m.GetDataSourceByIdQuery{Id: id, OrgId: c.OrgId}
	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	hs.cache.Set(cacheKey, query.Result, time.Second*5)
	return query.Result, nil
}

func (hs *HTTPServer) ProxyDataSourceRequest(c *m.ReqContext) {
	c.TimeRequest(metrics.M_DataSource_ProxyReq_Timer)

	dsId := c.ParamsInt64(":id")
	ds, err := hs.getDatasourceFromCache(dsId, c)

	if err != nil {
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

	// find plugin
	plugin, ok := plugins.DataSources[ds.Type]
	if !ok {
		c.JsonApiErr(500, "Unable to find datasource plugin", err)
		return
	}

	// macaron does not include trailing slashes when resolving a wildcard path
	proxyPath := ensureProxyPathTrailingSlash(c.Req.URL.Path, c.Params("*"))

	proxy := pluginproxy.NewDataSourceProxy(ds, plugin, c, proxyPath)
	proxy.HandleRequest()
}

// ensureProxyPathTrailingSlash Check for a trailing slash in original path and makes
// sure that a trailing slash is added to proxy path, if not already exists.
func ensureProxyPathTrailingSlash(originalPath, proxyPath string) string {
	if len(proxyPath) > 1 {
		if originalPath[len(originalPath)-1] == '/' && proxyPath[len(proxyPath)-1] != '/' {
			return proxyPath + "/"
		}
	}

	return proxyPath
}
