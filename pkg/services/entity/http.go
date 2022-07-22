package entity

import (
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/entity"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (s *StandardEntityStoreServer) RegisterEntityRoutes(route routing.RouteRegister) {
	route.Get("/*", s.doGetEntity)
	route.Delete("/*", routing.Wrap(s.doDelteEntity))
	route.Put("/*", routing.Wrap(s.doEntityUpdate))

	route.Post("/save", routing.Wrap(s.doSave))
	route.Post("/pr", routing.Wrap(s.doPR))
}

func (s *StandardEntityStoreServer) RegisterKindsRoutes(route routing.RouteRegister) {
	route.Get("/", routing.Wrap(s.doListKinds))
	route.Post("/test/:kind", routing.Wrap(s.doTestKind))
}

func (s *StandardEntityStoreServer) doGetEntity(c *models.ReqContext) {
	params := web.Params(c.Req)
	urlParams := c.Req.URL.Query()

	// Get the history
	if isTrue(urlParams, "history") {
		rsp, err := s.GetEntityHistory(c.Req.Context(), &entity.GetHistoryRequest{
			Path:       params["*"],
			MaxResults: 100,
			PageToken:  urlParams.Get("pageToken"),
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, map[string]string{"path": params["*"], "error": err.Error()})
		} else {
			c.JSON(http.StatusOK, rsp)
		}
		return
	}

	// regular get
	req := &entity.GetEntityRequest{
		Path:        params["*"],
		Version:     urlParams.Get("version"), // URL parameter
		WithPayload: true,
	}
	isRaw := isTrue(urlParams, "raw")
	if !isRaw {
		req.WithStorageMeta = true
		req.WithACL = true
		req.WithPRs = true
	}

	rsp, err := s.GetEntity(c.Req.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, map[string]string{"path": req.Path, "error": err.Error()})
		return
	}

	// Check for ETag updates
	if rsp.Meta != nil && rsp.Meta.Etag != "" {
		currentETag := rsp.Meta.Etag
		if isRaw {
			currentETag += "-raw"
		}
		c.Resp.Header().Set("ETag", currentETag)

		previousEtag := c.Req.Header.Get("If-None-Match")
		if previousEtag == currentETag {
			c.Resp.WriteHeader(http.StatusNotModified)
			return
		}
	}

	if isRaw {
		ct := "application/json"
		k := s.kinds.Get(rsp.Kind)
		if k != nil {
			ct = k.Info().ContentType
		}

		if ct != "" {
			c.Resp.Header().Set("Content-Type", ct)
		}

		c.Resp.WriteHeader(http.StatusOK)
		if _, err := c.Resp.Write(rsp.Payload); err != nil {
			logger.Warn("Error writing to response", "err", err)
		}
		c.Resp.Flush()
	} else {
		c.JSON(http.StatusOK, rsp)
	}
}

func (s *StandardEntityStoreServer) doDelteEntity(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	path := params["*"]

	return response.JSON(200, "DELETE: "+path)
}

func (s *StandardEntityStoreServer) doEntityUpdate(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	path := params["*"]

	return response.JSON(200, "UPDATE: "+path)
}

func (s *StandardEntityStoreServer) doSave(c *models.ReqContext) response.Response {
	return response.JSON(200, "TODO... save")
}

func (s *StandardEntityStoreServer) doPR(c *models.ReqContext) response.Response {
	return response.JSON(200, "TODO... create PR")
}

func (s *StandardEntityStoreServer) doListKinds(c *models.ReqContext) response.Response {
	rsp, err := s.ListKinds(c.Req.Context(), &entity.ListKindsRequest{})
	if err != nil {
		return response.Error(400, "error", err)
	}
	return response.JSON(200, rsp)
}

func (s *StandardEntityStoreServer) doTestKind(c *models.ReqContext) response.Response {
	return response.JSON(200, "TODO... test kind")
}

func isTrue(params url.Values, key string) bool {
	raw, ok := params[key]
	return ok && (raw[0] == "" || raw[0] == "true")
}
