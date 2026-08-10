package search

import (
	"net/http"
	"net/http/httptest"
	"testing"

	restful "github.com/emicklei/go-restful/v3"
	"github.com/stretchr/testify/assert"
)

// The search and trash endpoints are served at .../{resource}/search and
// .../{resource}/trash, which look like object paths, so they could shadow the
// standard routes or be shadowed by them. This dispatches through the router the
// apiserver installs, to show which handler each request actually reaches.
func TestSearchRouteDoesNotShadowStandardRoutes(t *testing.T) {
	const root = "/apis/dashboard.grafana.app/v0alpha1"

	container := restful.NewContainer()
	container.Router(restful.CurlyRouter{})

	var reached string
	record := func(name string) restful.RouteFunction {
		return func(*restful.Request, *restful.Response) { reached = name }
	}

	ws := new(restful.WebService)
	ws.Path(root)
	// Standard object and collection routes, as the apiserver registers them.
	ws.Route(ws.GET("/namespaces/{namespace}/dashboards/{name}").To(record("get-object")))
	ws.Route(ws.PUT("/namespaces/{namespace}/dashboards/{name}").To(record("replace-object")))
	ws.Route(ws.DELETE("/namespaces/{namespace}/dashboards/{name}").To(record("delete-object")))
	ws.Route(ws.GET("/namespaces/{namespace}/dashboards/{name}/dto").To(record("subresource")))
	ws.Route(ws.GET("/namespaces/{namespace}/dashboards").To(record("list")))
	ws.Route(ws.POST("/namespaces/{namespace}/dashboards").To(record("create")))
	// The legacy dashboard search route.
	ws.Route(ws.GET("/namespaces/{namespace}/search").To(record("legacy-search")))
	// The routes under test, mounted the same way SearchRoute and TrashRoute do.
	ws.Route(ws.POST("/namespaces/{namespace}/dashboards/" + searchPathSegment).To(record("search")))
	ws.Route(ws.POST("/namespaces/{namespace}/dashboards/" + trashPathSegment).To(record("trash")))
	container.Add(ws)

	for _, tc := range []struct {
		name    string
		method  string
		path    string
		handler string
	}{
		{"search endpoint", http.MethodPost, "/dashboards/search", "search"},
		{"trash endpoint", http.MethodPost, "/dashboards/trash", "trash"},
		// A dashboard may legitimately be named "search" or "trash"; every non-POST
		// verb must still reach the object routes.
		{"read a dashboard named search", http.MethodGet, "/dashboards/search", "get-object"},
		{"replace a dashboard named search", http.MethodPut, "/dashboards/search", "replace-object"},
		{"delete a dashboard named search", http.MethodDelete, "/dashboards/search", "delete-object"},
		{"read a dashboard named trash", http.MethodGet, "/dashboards/trash", "get-object"},
		{"replace a dashboard named trash", http.MethodPut, "/dashboards/trash", "replace-object"},
		{"delete a dashboard named trash", http.MethodDelete, "/dashboards/trash", "delete-object"},
		{"subresource of a dashboard named trash", http.MethodGet, "/dashboards/trash/dto", "subresource"},

		{"read another dashboard", http.MethodGet, "/dashboards/my-dash", "get-object"},
		{"subresource", http.MethodGet, "/dashboards/my-dash/dto", "subresource"},
		{"list", http.MethodGet, "/dashboards", "list"},
		{"create", http.MethodPost, "/dashboards", "create"},
		// The legacy endpoint lives at a different path and is unaffected.
		{"legacy search", http.MethodGet, "/search", "legacy-search"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reached = ""
			w := httptest.NewRecorder()
			container.ServeHTTP(w, httptest.NewRequest(tc.method, root+"/namespaces/default"+tc.path, nil))

			assert.Equal(t, http.StatusOK, w.Code)
			assert.Equal(t, tc.handler, reached)
		})
	}
}
