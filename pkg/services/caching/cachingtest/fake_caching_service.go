package cachingtest

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/caching"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

type FakeOSSCachingService struct {
	calls                  map[string]int
	ReturnStatus           caching.CacheStatus
	ReturnHit              bool
	ReturnResourceResponse caching.CachedResourceDataResponse
	ReturnQueryResponse    caching.CachedQueryDataResponse
}

func (f *FakeOSSCachingService) HandleQueryRequest(ctx context.Context, req *backend.QueryDataRequest) (bool, caching.CachedQueryDataResponse, caching.CacheStatus) {
	f.calls["HandleQueryRequest"]++
	return f.ReturnHit, f.ReturnQueryResponse, f.ReturnStatus
}

func (f *FakeOSSCachingService) HandleResourceRequest(ctx context.Context, req *backend.CallResourceRequest) (bool, caching.CachedResourceDataResponse, caching.CacheStatus) {
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
