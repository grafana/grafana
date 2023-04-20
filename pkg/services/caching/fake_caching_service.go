package caching

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

type FakeOSSCachingService struct {
	calls                  map[string]int
	ReturnHit              bool
	ReturnResourceResponse CachedResourceDataResponse
	ReturnQueryResponse    CachedQueryDataResponse
}

func (f *FakeOSSCachingService) CacheResourceResponse(ctx context.Context, req *backend.CallResourceRequest, resp *backend.CallResourceResponse) {
	f.calls["CacheResourceResponse"]++
}

func (f *FakeOSSCachingService) HandleQueryRequest(ctx context.Context, req *backend.QueryDataRequest) (bool, CachedQueryDataResponse) {
	f.calls["HandleQueryRequest"]++
	return f.ReturnHit, f.ReturnQueryResponse
}

func (f *FakeOSSCachingService) HandleResourceRequest(ctx context.Context, req *backend.CallResourceRequest) (bool, CachedResourceDataResponse) {
	f.calls["HandleResourceRequest"]++
	return f.ReturnHit, f.ReturnResourceResponse
}

func (f *FakeOSSCachingService) AssertCalls(t *testing.T, fn string, times int) {
	assert.Equal(t, times, f.calls[fn])
}

func (f *FakeOSSCachingService) Reset() {
	*f = *NewFakeOSSCachingService()
}

func NewFakeOSSCachingService() *FakeOSSCachingService {
	fake := &FakeOSSCachingService{
		calls: map[string]int{},
	}

	return fake
}
