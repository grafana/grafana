package pluginclient

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/web"
)

type PluginReference interface {
	PluginID() string
}

type appRef struct {
	pluginID string
}

func (r appRef) PluginID() string {
	return r.pluginID
}

// AppRef creates a new app PluginReference.
func AppRef(pluginID string) PluginReference {
	return &appRef{
		pluginID: pluginID,
	}
}

type DatasourceReference interface {
	PluginReference
	DatasourceID() int64
	DatasourceUID() string
	Datasource() *datasources.DataSource
}

type datasourceRef struct {
	pluginID      string
	datasourceID  int64
	datasourceUID string
	datasource    *datasources.DataSource
}

func (r datasourceRef) PluginID() string {
	return r.pluginID
}

func (r datasourceRef) DatasourceID() int64 {
	return r.datasourceID
}

func (r datasourceRef) DatasourceUID() string {
	return r.datasourceUID
}

func (r datasourceRef) Datasource() *datasources.DataSource {
	return r.datasource
}

type DatasourceReferenceOption func(ref *datasourceRef)

func WithDatasourceID(id int64) DatasourceReferenceOption {
	return DatasourceReferenceOption(func(ref *datasourceRef) {
		ref.datasourceID = id
	})
}

func WithDatasourceUID(uid string) DatasourceReferenceOption {
	return DatasourceReferenceOption(func(ref *datasourceRef) {
		ref.datasourceUID = uid
	})
}

func WithDatasource(ds *datasources.DataSource) DatasourceReferenceOption {
	return DatasourceReferenceOption(func(ref *datasourceRef) {
		ref.datasource = ds

		if ds != nil {
			ref.datasourceID = ds.ID
			ref.datasourceUID = ds.UID
		}
	})
}

// DatasourceRef creates a new datasource PluginReference.
func DatasourceRef(pluginID string, opts ...DatasourceReferenceOption) PluginReference {
	ref := &datasourceRef{
		pluginID: pluginID,
	}

	for _, opt := range opts {
		opt(ref)
	}

	return ref
}

type QueryDataRequest struct {
	Reference PluginReference

	// Headers the environment/metadata information for the request.
	//
	// To access forwarded HTTP headers please use
	// GetHTTPHeaders or GetHTTPHeader.
	Headers map[string]string

	// Queries the data queries for the request.
	Queries []backend.DataQuery
}

// QueryDataHandlerFunc is an adapter to allow the use of
// ordinary functions as QueryDataHandler. If f is a function
// with the appropriate signature, QueryDataHandlerFunc(f) is a
// Handler that calls f.
type QueryDataHandlerFunc func(ctx context.Context, req *QueryDataRequest) (*backend.QueryDataResponse, error)

// QueryData calls fn(ctx, req).
func (fn QueryDataHandlerFunc) QueryData(ctx context.Context, req *QueryDataRequest) (*backend.QueryDataResponse, error) {
	return fn(ctx, req)
}

type CheckHealthRequest struct {
	Reference PluginReference

	// Headers the environment/metadata information for the request.
	//
	// To access forwarded HTTP headers please use
	// GetHTTPHeaders or GetHTTPHeader.
	Headers map[string]string
}

type CallResourceRequest struct {
	Reference PluginReference

	// Path the forwarded HTTP path for the request.
	Path string

	// Method the forwarded HTTP method for the request.
	Method string

	// URL the forwarded HTTP URL for the request.
	URL string

	// Headers the forwarded HTTP headers for the request, if any.
	//
	// Recommended to use GetHTTPHeaders or GetHTTPHeader
	// since it automatically handles canonicalization of
	// HTTP header keys.
	Headers map[string][]string

	// Body the forwarded HTTP body for the request, if any.
	Body []byte

	// Validate if provided, will be used to validate the backend.PluginContext.
	Validate func(ctx context.Context, pCtx backend.PluginContext) error
}

// CallResourceHandlerFunc is an adapter to allow the use of
// ordinary functions as CallResourceHandler. If f is a function
// with the appropriate signature, CallResourceHandlerFunc(f) is a
// Handler that calls f.
type CallResourceHandlerFunc func(ctx context.Context, req *CallResourceRequest, sender backend.CallResourceResponseSender) error

// QueryData calls fn(ctx, req).
func (fn CallResourceHandlerFunc) CallResource(ctx context.Context, req *CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return fn(ctx, req, sender)
}

type CollectMetricsRequest struct {
	Reference PluginReference
}

// Client provider the client interface for interacting with plugins.
type Client interface {
	QueryData(ctx context.Context, req *QueryDataRequest) (*backend.QueryDataResponse, error)
	CheckHealth(ctx context.Context, req *CheckHealthRequest) (*backend.CheckHealthResult, error)
	CallResource(ctx context.Context, req *CallResourceRequest, sender backend.CallResourceResponseSender) error
	CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*backend.CollectMetricsResult, error)
}

func CallResourceRequestFromHTTPRequest(ref PluginReference, req *http.Request) (*CallResourceRequest, error) {
	if ref == nil {
		return nil, errors.New("ref cannot be nil")
	}

	if req == nil {
		return nil, errors.New("req cannot be nil")
	}

	clonedReq := req.Clone(req.Context())
	rawURL := web.Params(req)["*"]
	if clonedReq.URL.RawQuery != "" {
		rawURL += "?" + clonedReq.URL.RawQuery
	}
	urlPath, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	clonedReq.URL = urlPath

	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read request body: %w", err)
	}

	return &CallResourceRequest{
		Reference: ref,
		Path:      clonedReq.URL.Path,
		Method:    clonedReq.Method,
		URL:       clonedReq.URL.String(),
		Headers:   clonedReq.Header,
		Body:      body,
	}, nil
}
