package entity

import (
	"context"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/entity"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

// HACK until https://github.com/grafana/grafana/issues/50983
type key int

const (
	TempSignedInUserKey key = iota
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
	ctx := context.WithValue(c.Req.Context(), TempSignedInUserKey, c.SignedInUser)

	// Get the history
	if isTrue(urlParams, "history") {
		rsp, err := s.GetEntityHistory(ctx, &entity.GetHistoryRequest{
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
	withMeta := isTrue(urlParams, "meta")
	if withMeta {
		req.WithStorageMeta = true
		req.WithACL = true
		req.WithPRs = true
	}

	rsp, err := s.GetEntity(ctx, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, map[string]string{"path": req.Path, "error": err.Error()})
		return
	}

	// Check for ETag updates
	if rsp.Meta != nil && rsp.Meta.Etag != "" {
		currentETag := rsp.Meta.Etag
		if withMeta {
			currentETag += "-meta"
		}
		c.Resp.Header().Set("ETag", currentETag)

		previousEtag := c.Req.Header.Get("If-None-Match")
		if previousEtag == currentETag {
			c.Resp.WriteHeader(http.StatusNotModified)
			return
		}
	}

	if withMeta {
		c.JSON(http.StatusOK, rsp)
	} else {
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
	}
}

func (s *StandardEntityStoreServer) doDelteEntity(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	path := params["*"]
	urlParams := c.Req.URL.Query()

	ctx := context.WithValue(c.Req.Context(), TempSignedInUserKey, c.SignedInUser)
	rsp, err := s.DeleteEntity(ctx, &entity.DeleteEntityRequest{
		Path:      path,
		Version:   urlParams.Get("version"),
		Recursive: isTrue(urlParams, "recursive"),
	})
	if err != nil {
		return response.Err(err)
	}
	return response.JSON(200, rsp)
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
	ctx := context.WithValue(c.Req.Context(), TempSignedInUserKey, c.SignedInUser)
	rsp, err := s.ListKinds(ctx, &entity.ListKindsRequest{})
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
