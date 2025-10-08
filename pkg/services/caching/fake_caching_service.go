package caching

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

type FakeOSSCachingService struct {
	calls                  map[string]int
	ReturnStatus           CacheStatus
	ReturnHit              bool
	ReturnResourceResponse CachedResourceDataResponse
	ReturnQueryResponse    CachedQueryDataResponse
}

func (f *FakeOSSCachingService) HandleQueryRequest(ctx context.Context, req *backend.QueryDataRequest) (bool, CachedQueryDataResponse, CacheStatus) {
	f.calls["HandleQueryRequest"]++
	return f.ReturnHit, f.ReturnQueryResponse, f.ReturnStatus
}

func (f *FakeOSSCachingService) HandleResourceRequest(ctx context.Context, req *backend.CallResourceRequest) (bool, CachedResourceDataResponse, CacheStatus) {
	f.calls["HandleResourceRequest"]++
	return f.ReturnHit, f.ReturnResourceResponse, f.ReturnStatus
}

func (f *FakeOSSCachingService) AssertCalls(t *testing.T, fn string, times int) {
	assert.Equal(t, times, f.calls[fn])
}

func (f *FakeOSSCachingService) Reset() {
	*f = *NewFakeOSSCachingService()
}

func NewFakeOSSCachingService() *FakeOSSCachingService {
	fake := &FakeOSSCachingService{
		calls:        map[string]int{},
		ReturnStatus: "unset",
	}

	return fake
}
