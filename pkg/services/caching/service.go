package caching

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"

	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/prometheus/client_golang/prometheus"
)

type CacheStatus string

const (
	XCacheHeader               = "X-Cache"
	StatusHit      CacheStatus = "HIT"
	StatusMiss     CacheStatus = "MISS"
	StatusBypass   CacheStatus = "BYPASS"
	StatusError    CacheStatus = "ERROR"
	StatusDisabled CacheStatus = "DISABLED"
)

// needed to mock the function for testing
var ShouldCacheQuery = awsds.ShouldCacheQuery

type CacheQueryResponseFn func(context.Context, *backend.QueryDataResponse)
type CacheResourceResponseFn func(context.Context, *backend.CallResourceResponse)

type CachedQueryDataResponse struct {
	// The cached data response associated with a query, or nil if no cached data is found
	Response *backend.QueryDataResponse
	// A function that should be used to cache a QueryDataResponse for a given query.
	// It can be set to nil by the method implementation (if there is an error, for example), so it should be checked before being called.
	UpdateCacheFn CacheQueryResponseFn
}

type CachedResourceDataResponse struct {
	// The cached response associated with a resource request, or nil if no cached data is found
	Response *backend.CallResourceResponse
	// A function that should be used to cache a CallResourceResponse for a given resource request.
	// It can be set to nil by the method implementation (if there is an error, for example), so it should be checked before being called.
	// Because plugins can send multiple responses asynchronously, the implementation should be able to handle multiple calls to this function for one request.
	UpdateCacheFn CacheResourceResponseFn
}

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

type CachingService interface {
	// HandleQueryRequest uses a QueryDataRequest to check the cache for any existing results for that query.
	// If none are found, it should return false and a CachedQueryDataResponse with an UpdateCacheFn which can be used to update the results cache after the fact.
	// This function may populate any response headers (accessible through the context) with the cache status using the X-Cache header.
	HandleQueryRequest(ctx context.Context, namespace string, req *backend.QueryDataRequest) (bool, CachedQueryDataResponse, CacheStatus)
	// HandleResourceRequest uses a CallResourceRequest to check the cache for any existing results for that request. If none are found, it should return false.
	// This function may populate any response headers (accessible through the context) with the cache status using the X-Cache header.
	HandleResourceRequest(ctx context.Context, namespace string, req *backend.CallResourceRequest) (bool, CachedResourceDataResponse, CacheStatus)
}

// Implementation of interface - does nothing
type OSSCachingService struct {
}

func (s *OSSCachingService) HandleQueryRequest(ctx context.Context, namspace string, req *backend.QueryDataRequest) (bool, CachedQueryDataResponse, CacheStatus) {
	return false, CachedQueryDataResponse{}, ""
}

func (s *OSSCachingService) HandleResourceRequest(ctx context.Context, namespace string, req *backend.CallResourceRequest) (bool, CachedResourceDataResponse, CacheStatus) {
	return false, CachedResourceDataResponse{}, ""
}

var _ CachingService = &OSSCachingService{}

// GetKey creates a prefixed cache key and uses the internal `encoder` to encode the query into a string
func GetKey(namespace string, prefix string, query interface{}) (string, error) {
	keybuf := bytes.NewBuffer(nil)

	encoder := &JSONEncoder{}

	if err := encoder.Encode(keybuf, query); err != nil {
		return "", err
	}

	key, err := SHA256KeyFunc(keybuf)
	if err != nil {
		return "", err
	}

	return strings.Join([]string{namespace, prefix, key}, ":"), nil
}

// SHA256KeyFunc copies the data from `r` into a sha256.Hash, and returns the encoded Sum.
func SHA256KeyFunc(r io.Reader) (string, error) {
	hash := sha256.New()

	// Read all data from the provided reader
	if _, err := io.Copy(hash, r); err != nil {
		return "", err
	}

	// Encode the written values to SHA256
	return hex.EncodeToString(hash.Sum(nil)), nil
}

// JSONEncoder encodes and decodes struct data to/from JSON
type JSONEncoder struct{}

// NewJSONEncoder creates a pointer to a new JSONEncoder, which implements the `Encoder` interface
func NewJSONEncoder() *JSONEncoder {
	return &JSONEncoder{}
}

func (e *JSONEncoder) EncodeBytes(w io.Writer, b []byte) error {
	_, err := w.Write(b)
	if err != nil {
		return err
	}
	return nil
}

func (e *JSONEncoder) DecodeBytes(r io.Reader) ([]byte, error) {
	encBytes, err := io.ReadAll(r)
	if err != nil {
		return []byte{}, err
	}
	return encBytes, err
}

// Encode encodes the `v` interface into `w` using a json.Encoder
func (e *JSONEncoder) Encode(w io.Writer, v interface{}) error {
	return json.NewEncoder(w).Encode(v)
}

// Decode encodes the io.Reader `r` into the interface `v` using a json.Decoder
func (e *JSONEncoder) Decode(r io.Reader, v interface{}) error {
	return json.NewDecoder(r).Decode(v)
}

// A service that provides methods to cache requests.
// It can be used to cache requests using `caching.CachingService` without reimplementing
// the caching logic at every call site.
type CachingServiceClient struct {
	cachingService CachingService
	features       featuremgmt.FeatureToggles
}

func ProvideCachingServiceClient(cachingService CachingService, features featuremgmt.FeatureToggles) *CachingServiceClient {
	log := log.New("caching_service_client")
	if err := prometheus.Register(QueryCachingRequestHistogram); err != nil {
		log.Error("Error registering prometheus collector 'QueryRequestHistogram'", "error", err)
	}
	if err := prometheus.Register(ResourceCachingRequestHistogram); err != nil {
		log.Error("Error registering prometheus collector 'ResourceRequestHistogram'", "error", err)
	}
	return &CachingServiceClient{cachingService: cachingService, features: features}
}

// WithQueryDataCaching calls `f` and caches the returned value if `req` has not been cached already.
// Returns the cached value otherwise.
func (c *CachingServiceClient) WithQueryDataCaching(ctx context.Context, namespace string, req *backend.QueryDataRequest, f func() (*backend.QueryDataResponse, error)) (*backend.QueryDataResponse, error) {
	if c == nil || namespace == "" || req == nil {
		return f()
	}

	reqCtx := contexthandler.FromContext(ctx)

	// time how long this request takes
	start := time.Now()

	// First look in the query cache if enabled
	hit, cr, status := c.cachingService.HandleQueryRequest(ctx, namespace, req)

	// record request duration if caching was used
	if reqCtx != nil {
		reqCtx.Resp.Header().Set(XCacheHeader, string(status))
		defer func() {
			QueryCachingRequestHistogram.With(prometheus.Labels{
				"datasource_type": getDatasourceType(req.PluginContext),
				"cache":           string(status),
				"query_type":      getQueryType(reqCtx),
			}).Observe(time.Since(start).Seconds())
		}()
	}

	// Cache hit; return the response
	if hit {
		return cr.Response, nil
	}

	// Cache miss; do the actual queries
	resp, err := f()
	// Update the query cache with the result for this metrics request
	if err == nil && cr.UpdateCacheFn != nil {
		// If AWS async caching is not enabled, use the old code path
		if c.features == nil || !c.features.IsEnabled(ctx, featuremgmt.FlagAwsAsyncQueryCaching) {
			cr.UpdateCacheFn(ctx, resp)
		} else if reqCtx != nil {
			// time how long shouldCacheQuery takes
			startShouldCacheQuery := time.Now()
			shouldCache := ShouldCacheQuery(resp)
			ShouldCacheQueryHistogram.With(prometheus.Labels{
				"datasource_type": req.PluginContext.DataSourceInstanceSettings.Type,
				"cache":           string(status),
				"shouldCache":     strconv.FormatBool(shouldCache),
				"query_type":      getQueryType(reqCtx),
			}).Observe(time.Since(startShouldCacheQuery).Seconds())

			// If AWS async caching is enabled and resp is for a running async query, don't cache it
			if shouldCache {
				cr.UpdateCacheFn(ctx, resp)
			}
		}
	}

	return resp, err
}

// WithCallResourceCaching calls `f` and caches the returned value if `req` has not been cached already.
// Returns the cached value otherwise.
func (c *CachingServiceClient) WithCallResourceCaching(ctx context.Context, namespace string, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender, f func(backend.CallResourceResponseSender) error) error {
	if c == nil || namespace == "" || req == nil {
		return f(sender)
	}

	reqCtx := contexthandler.FromContext(ctx)

	// time how long this request takes
	start := time.Now()

	// First look in the resource cache if enabled
	hit, cr, status := c.cachingService.HandleResourceRequest(ctx, namespace, req)

	if reqCtx != nil {
		reqCtx.Resp.Header().Set(XCacheHeader, string(status))
	}
	// record request duration if caching was used
	defer func() {
		ResourceCachingRequestHistogram.With(prometheus.Labels{
			"plugin_id": req.PluginContext.PluginID,
			"cache":     string(status),
		}).Observe(time.Since(start).Seconds())
	}()

	// Cache hit; send the response and return
	if hit {
		return sender.Send(cr.Response)
	}

	// Cache miss; do the actual request
	// If there is no update cache func, just pass in the original sender
	if cr.UpdateCacheFn == nil {
		return f(sender)
	}
	// Otherwise, intercept the responses in a wrapped sender so we can cache them first
	cacheSender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
		cr.UpdateCacheFn(ctx, res)
		return sender.Send(res)
	})

	return f(cacheSender)
}

func getDatasourceType(pluginCtx backend.PluginContext) string {
	if pluginCtx.DataSourceInstanceSettings == nil {
		return "unknown"
	}
	return pluginCtx.DataSourceInstanceSettings.Name
}
