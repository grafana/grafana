package httpobjectstore

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/services/store/object"
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
	store object.ObjectStoreServer
	log   log.Logger
	kinds kind.KindRegistry
}

func ProvideHTTPObjectStore(store object.ObjectStoreServer, kinds kind.KindRegistry) HTTPObjectStore {
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
	route.Get("/store/:kind/:uid", reqGrafanaAdmin, routing.Wrap(s.doGetObject))
	route.Post("/store/:kind/:uid", reqGrafanaAdmin, routing.Wrap(s.doWriteObject))
	route.Delete("/store/:kind/:uid", reqGrafanaAdmin, routing.Wrap(s.doDeleteObject))
	route.Get("/raw/:kind/:uid", reqGrafanaAdmin, routing.Wrap(s.doGetRawObject))
	route.Get("/history/:kind/:uid", reqGrafanaAdmin, routing.Wrap(s.doGetHistory))
	route.Get("/list/:uid", reqGrafanaAdmin, routing.Wrap(s.doListFolder)) // Simplified version of search -- path is prefix
	route.Get("/search", reqGrafanaAdmin, routing.Wrap(s.doSearch))

	// File upload
	route.Post("/upload", reqGrafanaAdmin, routing.Wrap(s.doUpload))
}

// This function will extract UID+Kind from the requested path "*" in our router
// This is far from ideal! but is at least consistent for these endpoints.
// This will quickly be revisited as we explore how to encode UID+Kind in a "GRN" format
func (s *httpObjectStore) getGRNFromRequest(c *models.ReqContext) (*object.GRN, map[string]string, error) {
	params := web.Params(c.Req)
	// Read parameters that are encoded in the URL
	vals := c.Req.URL.Query()
	for k, v := range vals {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}
	return &object.GRN{
		TenantId: c.OrgID,
		Kind:     params[":kind"],
		UID:      params[":uid"],
	}, params, nil
}

func (s *httpObjectStore) doGetObject(c *models.ReqContext) response.Response {
	grn, params, err := s.getGRNFromRequest(c)
	if err != nil {
		return response.Error(400, err.Error(), err)
	}
	rsp, err := s.store.Read(c.Req.Context(), &object.ReadObjectRequest{
		GRN:         grn,
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
	grn, params, err := s.getGRNFromRequest(c)
	if err != nil {
		return response.Error(400, err.Error(), err)
	}
	rsp, err := s.store.Read(c.Req.Context(), &object.ReadObjectRequest{
		GRN:         grn,
		Version:     params["version"], // ?version = XYZ
		WithBody:    true,
		WithSummary: false,
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	info, err := s.kinds.GetInfo(grn.Kind)
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
	grn, params, err := s.getGRNFromRequest(c)
	if err != nil {
		return response.Error(400, err.Error(), err)
	}

	// Cap the max size
	c.Req.Body = http.MaxBytesReader(c.Resp, c.Req.Body, MAX_UPLOAD_SIZE)
	b, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(400, "error reading body", err)
	}

	rsp, err := s.store.Write(c.Req.Context(), &object.WriteObjectRequest{
		GRN:             grn,
		Body:            b,
		Folder:          params["folder"],
		Comment:         params["comment"],
		PreviousVersion: params["previousVersion"],
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doDeleteObject(c *models.ReqContext) response.Response {
	grn, params, err := s.getGRNFromRequest(c)
	if err != nil {
		return response.Error(400, err.Error(), err)
	}
	rsp, err := s.store.Delete(c.Req.Context(), &object.DeleteObjectRequest{
		GRN:             grn,
		PreviousVersion: params["previousVersion"],
	})
	if err != nil {
		return response.Error(500, "?", err)
	}
	return response.JSON(200, rsp)
}

func (s *httpObjectStore) doGetHistory(c *models.ReqContext) response.Response {
	grn, params, err := s.getGRNFromRequest(c)
	if err != nil {
		return response.Error(400, err.Error(), err)
	}
	limit := int64(20) // params
	rsp, err := s.store.History(c.Req.Context(), &object.ObjectHistoryRequest{
		GRN:           grn,
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
	fileinfo := c.Req.MultipartForm.File
	if len(fileinfo) < 1 {
		return response.Error(400, "missing files", nil)
	}

	var rsp []*object.WriteObjectResponse

	message := getMultipartFormValue(c.Req, "message")
	overwriteExistingFile := getMultipartFormValue(c.Req, "overwriteExistingFile") != "false" // must explicitly overwrite
	folder := getMultipartFormValue(c.Req, "folder")
	ctx := c.Req.Context()

	for _, fileHeaders := range fileinfo {
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
			uid := fileHeader.Filename[:idx]

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

			grn := &object.GRN{
				UID:      uid,
				Kind:     kind.ID,
				TenantId: c.OrgID,
			}

			if !overwriteExistingFile {
				result, err := s.store.Read(ctx, &object.ReadObjectRequest{
					GRN:         grn,
					WithBody:    false,
					WithSummary: false,
				})
				if err != nil {
					return response.Error(500, "Internal Server Error", err)
				}
				if result.Object != nil {
					return response.Error(400, "File name already in use", err)
				}
			}

			result, err := s.store.Write(ctx, &object.WriteObjectRequest{
				GRN:     grn,
				Body:    data,
				Comment: message,
				Folder:  folder,
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

	req := &object.ObjectSearchRequest{
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
