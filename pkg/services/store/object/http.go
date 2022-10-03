package object

import (
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/web"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
)

type HTTPObjectStore interface {
	// Register HTTP Access to the store
	RegisterHTTPRoutes(routing.RouteRegister)
}

type httpObjectStore struct {
	store ObjectStoreServer
	log   log.Logger
}

func ProvideHTTPObjectStore(store ObjectStoreServer) HTTPObjectStore {
	return &httpObjectStore{
		store: store,
		log:   log.New("http-object-store"),
	}
}

// All registered under "api/object"
func (s *httpObjectStore) RegisterHTTPRoutes(route routing.RouteRegister) {
	// For now, require admin for everything
	reqGrafanaAdmin := middleware.ReqSignedIn //.ReqGrafanaAdmin

	// Every * must parse to a GRN (uid+kind)
	route.Get("/store/*", reqGrafanaAdmin, routing.Wrap(s.doGetOject))
	route.Get("/raw/*", reqGrafanaAdmin, routing.Wrap(s.doGetRawOject))
	route.Post("/store/*", reqGrafanaAdmin, routing.Wrap(s.doWriteObject))
	route.Delete("/store/*", reqGrafanaAdmin, routing.Wrap(s.doDeleteObject))
	route.Get("/history/*", reqGrafanaAdmin, routing.Wrap(s.doGetHistory))
	route.Get("/list/*", reqGrafanaAdmin, routing.Wrap(s.doListFolder)) // Simplified version of search -- path is prefix
	route.Get("/search", reqGrafanaAdmin, routing.Wrap(s.doSearch))
}

// GRN? path >> UID + kind???
func parseRequestParams(req *http.Request) (uid string, kind string, params map[string]string) {
	params = web.Params(req)
	path := params["*"]
	idx := strings.LastIndex(path, ".")
	if idx > 0 {
		uid = path[:idx]
		kind = path[idx:]
	} else {
		uid = path
		kind = "?"
	}
	return
}

func (s *httpObjectStore) doGetOject(c *models.ReqContext) response.Response {
	uid, kind, params := parseRequestParams(c.Req)
	rsp, err := s.store.Read(c.Req.Context(), &ReadObjectRequest{
		UID:         uid,
		Kind:        kind,
		Version:     params["version"], // ?version = XYZ
		WithBody:    true,              // ?? allow false?
		WithSummary: true,              // ?? allow false?
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	if rsp.Object == nil {
		rsp.Object = &RawObject{
			UID:      uid,
			Kind:     "missing!",
			Modified: time.Now().UnixMilli(),
		}
	}
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doGetRawOject(c *models.ReqContext) response.Response {
	uid, kind, params := parseRequestParams(c.Req)
	rsp, err := s.store.Read(c.Req.Context(), &ReadObjectRequest{
		UID:         uid,
		Kind:        kind,
		Version:     params["version"], // ?version = XYZ
		WithBody:    true,
		WithSummary: false,
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	if rsp.Object != nil && rsp.Object.Body != nil {
		return response.CreateNormalResponse(
			http.Header{
				"Content-Type": []string{"application/json"}, // TODO, based on kind!!!
			},
			rsp.Object.Body,
			200,
		)
	}
	return response.JSON(400, rsp) // ???
}

func (s *httpObjectStore) doWriteObject(c *models.ReqContext) response.Response {
	uid, kind, params := parseRequestParams(c.Req)
	b, err := ioutil.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(400, "error reading body", err)
	}

	rsp, err := s.store.Write(c.Req.Context(), &WriteObjectRequest{
		UID:             uid,
		Kind:            kind,
		Body:            b,
		Comment:         params["comment"],
		PreviousVersion: params["previous"],
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doDeleteObject(c *models.ReqContext) response.Response {
	uid, kind, params := parseRequestParams(c.Req)
	rsp, err := s.store.Delete(c.Req.Context(), &DeleteObjectRequest{
		UID:             uid,
		Kind:            kind,
		PreviousVersion: params["previous"],
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doGetHistory(c *models.ReqContext) response.Response {
	uid, kind, params := parseRequestParams(c.Req)
	limit := int64(20) // params
	rsp, err := s.store.History(c.Req.Context(), &ObjectHistoryRequest{
		UID:           uid,
		Kind:          kind,
		Limit:         limit,
		NextPageToken: params["nextPageToken"],
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doListFolder(c *models.ReqContext) response.Response {
	return response.JSON(500, "Not implemented yet")
}

func (s *httpObjectStore) doSearch(c *models.ReqContext) response.Response {
	return response.JSON(500, "Not implemented yet")
}
