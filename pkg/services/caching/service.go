package caching

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	XCacheHeader   = "X-Cache"
	StatusHit      = "HIT"
	StatusMiss     = "MISS"
	StatusBypass   = "BYPASS"
	StatusError    = "ERROR"
	StatusDisabled = "DISABLED"
)

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
	HandleQueryRequest(context.Context, *backend.QueryDataRequest) (bool, CachedQueryDataResponse)
	// HandleResourceRequest uses a CallResourceRequest to check the cache for any existing results for that request. If none are found, it should return false.
	// This function may populate any response headers (accessible through the context) with the cache status using the X-Cache header.
	HandleResourceRequest(context.Context, *backend.CallResourceRequest) (bool, CachedResourceDataResponse)
}

// Implementation of interface - does nothing
type OSSCachingService struct {
}

func (s *OSSCachingService) HandleQueryRequest(ctx context.Context, req *backend.QueryDataRequest) (bool, CachedQueryDataResponse) {
	return false, CachedQueryDataResponse{}
}

func (s *OSSCachingService) HandleResourceRequest(ctx context.Context, req *backend.CallResourceRequest) (bool, CachedResourceDataResponse) {
	return false, CachedResourceDataResponse{}
}

var _ CachingService = &OSSCachingService{}

// GetKey creates a prefixed cache key and uses the internal `encoder` to encode the query into a string
func GetKey(prefix string, query interface{}) (string, error) {
	keybuf := bytes.NewBuffer(nil)

	encoder := &JSONEncoder{}

	if err := encoder.Encode(keybuf, query); err != nil {
		return "", err
	}

	key, err := SHA256KeyFunc(keybuf)
	if err != nil {
		return "", err
	}

	return strings.Join([]string{prefix, key}, ":"), nil
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
