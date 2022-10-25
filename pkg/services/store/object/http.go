package object

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/grn"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/util"
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
	kinds kind.KindRegistry
}

func ProvideHTTPObjectStore(store ObjectStoreServer, kinds kind.KindRegistry) HTTPObjectStore {
	return &httpObjectStore{
		store: store,
		log:   log.New("http-object-store"),
		kinds: kinds,
	}
}

// All registered under "api/object"
func (s *httpObjectStore) RegisterHTTPRoutes(route routing.RouteRegister) {
	// For now, require admin for everything
	reqGrafanaAdmin := middleware.ReqSignedIn //.ReqGrafanaAdmin

	// Every * must parse to a GRN (uid+kind)
	route.Get("/store/*", reqGrafanaAdmin, routing.Wrap(s.doGetObject))
	route.Get("/raw/*", reqGrafanaAdmin, routing.Wrap(s.doGetRawObject))
	route.Post("/store/*", reqGrafanaAdmin, routing.Wrap(s.doWriteObject))
	route.Delete("/store/*", reqGrafanaAdmin, routing.Wrap(s.doDeleteObject))
	route.Get("/history/*", reqGrafanaAdmin, routing.Wrap(s.doGetHistory))
	route.Get("/list/*", reqGrafanaAdmin, routing.Wrap(s.doListFolder)) // Simplified version of search -- path is prefix
	route.Get("/search", reqGrafanaAdmin, routing.Wrap(s.doSearch))

	// File upload
	route.Post("/upload", reqGrafanaAdmin, routing.Wrap(s.doUpload))
}

// This function will extract UID+Kind from the requested path "*" in our router
// This is far from ideal! but is at least consistent for these endpoints.
// This will quickly be revisited as we explore how to encode UID+Kind in a "GRN" format
func parseRequestParams(c *models.ReqContext) (grn.GRN, map[string]string) {
	req := c.Req
	grn := grn.GRN{TenantID: c.OrgID}

	params := web.Params(req)
	path := params["*"]
	idx := strings.LastIndex(path, ".")
	if idx > 0 {
		grn.ResourceIdentifier = path[:idx]
		grn.ResourceKind = path[idx+1:]
	} else {
		grn.ResourceIdentifier = path
	}

	// Read parameters that are encoded in the URL
	vals := req.URL.Query()
	for k, v := range vals {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}
	return grn, params
}

func (s *httpObjectStore) doGetObject(c *models.ReqContext) response.Response {
	grn, params := parseRequestParams(c)

	rsp, err := s.store.Read(c.Req.Context(), &ReadObjectRequest{
		GRN:         grn.String(),
		Version:     params["version"],           // ?version = XYZ
		WithBody:    params["body"] != "false",   // default to true
		WithSummary: params["summary"] == "true", // default to false
	})
	if err != nil {
		return response.Error(500, "error fetching object", err)
	}
	if rsp.Object == nil {
		return response.Error(404, "not found", nil)
	}

	// Configure etag support
	currentEtag := rsp.Object.ETag
	previousEtag := c.Req.Header.Get("If-None-Match")
	if previousEtag == currentEtag {
		return response.CreateNormalResponse(
			http.Header{
				"ETag": []string{rsp.Object.ETag},
			},
			[]byte{},               // nothing
			http.StatusNotModified, // 304
		)
	}

	c.Resp.Header().Set("ETag", currentEtag)
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doGetRawObject(c *models.ReqContext) response.Response {
	grn, params := parseRequestParams(c)
	rsp, err := s.store.Read(c.Req.Context(), &ReadObjectRequest{
		GRN:         grn.String(),
		Version:     params["version"], // ?version = XYZ
		WithBody:    true,
		WithSummary: false,
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	info, err := s.kinds.GetInfo(grn.ResourceKind)
	if err != nil {
		return response.Error(400, "Unsupported kind", err)
	}

	if rsp.Object != nil && rsp.Object.Body != nil {
		// Configure etag support
		currentEtag := rsp.Object.ETag
		previousEtag := c.Req.Header.Get("If-None-Match")
		if previousEtag == currentEtag {
			return response.CreateNormalResponse(
				http.Header{
					"ETag": []string{rsp.Object.ETag},
				},
				[]byte{},               // nothing
				http.StatusNotModified, // 304
			)
		}
		mime := info.MimeType
		if mime == "" {
			mime = "application/json"
		}
		return response.CreateNormalResponse(
			http.Header{
				"Content-Type": []string{mime},
				"ETag":         []string{currentEtag},
			},
			rsp.Object.Body,
			200,
		)
	}
	return response.JSON(400, rsp) // ???
}

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024 // 5MB

func (s *httpObjectStore) doWriteObject(c *models.ReqContext) response.Response {
	grn, params := parseRequestParams(c)

	// Cap the max size
	c.Req.Body = http.MaxBytesReader(c.Resp, c.Req.Body, MAX_UPLOAD_SIZE)
	b, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(400, "error reading body", err)
	}

	rsp, err := s.store.Write(c.Req.Context(), &WriteObjectRequest{
		GRN:             grn.String(),
		Body:            b,
		Comment:         params["comment"],
		PreviousVersion: params["previousVersion"],
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doDeleteObject(c *models.ReqContext) response.Response {
	grn, params := parseRequestParams(c)

	rsp, err := s.store.Delete(c.Req.Context(), &DeleteObjectRequest{
		GRN:             grn.String(),
		PreviousVersion: params["previousVersion"],
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doGetHistory(c *models.ReqContext) response.Response {
	grn, params := parseRequestParams(c)

	limit := int64(20) // params
	rsp, err := s.store.History(c.Req.Context(), &ObjectHistoryRequest{
		GRN:           grn.String(),
		Limit:         limit,
		NextPageToken: params["nextPageToken"],
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doUpload(c *models.ReqContext) response.Response {
	c.Req.Body = http.MaxBytesReader(c.Resp, c.Req.Body, MAX_UPLOAD_SIZE)
	if err := c.Req.ParseMultipartForm(MAX_UPLOAD_SIZE); err != nil {
		msg := fmt.Sprintf("Please limit file uploaded under %s", util.ByteCountSI(MAX_UPLOAD_SIZE))
		return response.Error(400, msg, nil)
	}
	var rsp []*WriteObjectResponse

	message := getMultipartFormValue(c.Req, "message")
	overwriteExistingFile := getMultipartFormValue(c.Req, "overwriteExistingFile") != "false" // must explicitly overwrite
	folder := getMultipartFormValue(c.Req, "folder")

	for _, fileHeaders := range c.Req.MultipartForm.File {
		for _, fileHeader := range fileHeaders {
			idx := strings.LastIndex(fileHeader.Filename, ".")
			if idx <= 0 {
				return response.Error(400, "Expecting file extension: "+fileHeader.Filename, nil)
			}

			ext := strings.ToLower(fileHeader.Filename[idx+1:])
			kind, err := s.kinds.GetFromExtension(ext)
			if err != nil || kind.ID == "" {
				return response.Error(400, "Unsupported kind: "+fileHeader.Filename, err)
			}
			uid := folder
			if uid != "" {
				uid = uid + "/" + fileHeader.Filename[:idx]
			} else {
				uid = fileHeader.Filename[:idx]
			}
			grn := grn.GRN{
				TenantID:           c.OrgID,
				ResourceKind:       kind.ID,
				ResourceIdentifier: uid,
			}

			file, err := fileHeader.Open()
			if err != nil {
				return response.Error(500, "Internal Server Error", err)
			}
			data, err := io.ReadAll(file)
			if err != nil {
				return response.Error(500, "Internal Server Error", err)
			}
			err = file.Close()
			if err != nil {
				return response.Error(500, "Internal Server Error", err)
			}
			// mimeType := http.DetectContentType(data)

			if !overwriteExistingFile {
				fmt.Printf("TODO! check previous version exits?\n")
			}

			result, err := s.store.Write(c.Req.Context(), &WriteObjectRequest{
				GRN:     grn.String(),
				Body:    data,
				Comment: message,
				//	PreviousVersion: params["previousVersion"],
			})

			if err != nil {
				return response.Error(500, err.Error(), err) // TODO, better errors
			}
			rsp = append(rsp, result)
		}
	}

	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doListFolder(c *models.ReqContext) response.Response {
	return response.JSON(501, "Not implemented yet")
}

func (s *httpObjectStore) doSearch(c *models.ReqContext) response.Response {
	vals := c.Req.URL.Query()

	req := &ObjectSearchRequest{
		WithBody:   asBoolean("body", vals, false),
		WithLabels: asBoolean("labels", vals, true),
		WithFields: asBoolean("fields", vals, true),
		Kind:       vals["kind"],
		Query:      vals.Get("query"),
		Folder:     vals.Get("folder"),
		Sort:       vals["sort"],
	}
	if vals.Has("limit") {
		limit, err := strconv.ParseInt(vals.Get("limit"), 10, 64)
		if err != nil {
			return response.Error(400, "bad limit", err)
		}
		req.Limit = limit
	}

	rsp, err := s.store.Search(c.Req.Context(), req)
	if err != nil {
		return response.Error(500, "?", err)
	}
	return response.JSON(200, rsp)
}

func asBoolean(key string, vals url.Values, defaultValue bool) bool {
	v, ok := vals[key]
	if !ok {
		return defaultValue
	}
	if len(v) == 0 {
		return true // single boolean parameter
	}
	b, err := strconv.ParseBool(v[0])
	if err != nil {
		return defaultValue
	}
	return b
}

func getMultipartFormValue(req *http.Request, key string) string {
	v, ok := req.MultipartForm.Value[key]
	if !ok || len(v) != 1 {
		return ""
	}
	return v[0]
}
