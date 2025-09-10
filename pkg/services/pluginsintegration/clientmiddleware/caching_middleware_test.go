package clientmiddleware

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana/pkg/services/caching"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCachingMiddleware(t *testing.T) {
	t.Run("When QueryData is called", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/query", nil)
		require.NoError(t, err)

		cs := caching.NewFakeOSSCachingService()
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			handlertest.WithMiddlewares(NewCachingMiddleware(cs)),
		)

		jsonDataMap := map[string]any{}
		jsonDataBytes, err := json.Marshal(&jsonDataMap)
		require.NoError(t, err)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				JSONData: jsonDataBytes,
			},
		}

		// Populated by clienttest.WithReqContext
		reqCtx := contexthandler.FromContext(req.Context())
		require.NotNil(t, reqCtx)

		qdr := &backend.QueryDataRequest{
			PluginContext: pluginCtx,
		}

		// Track whether the update cache fn was called, depending on what the response headers are in the cache request
		var updateCacheCalled bool
		dataResponse := caching.CachedQueryDataResponse{
			Response: &backend.QueryDataResponse{},
			UpdateCacheFn: func(ctx context.Context, qdr *backend.QueryDataResponse) {
				updateCacheCalled = true
			},
		}

		t.Run("If cache returns a hit, no queries are issued", func(t *testing.T) {
			t.Cleanup(func() {
				updateCacheCalled = false
				cs.Reset()
			})

			cs.ReturnHit = true
			cs.ReturnQueryResponse = dataResponse

			resp, err := cdt.MiddlewareHandler.QueryData(req.Context(), qdr)
			assert.NoError(t, err)
			// Cache service is called once
			cs.AssertCalls(t, "HandleQueryRequest", 1)
			// Equals the mocked response
			assert.NotNil(t, resp)
			assert.Equal(t, dataResponse.Response, resp)
			// Cache was not updated by the middleware
			assert.False(t, updateCacheCalled)
		})

		t.Run("If cache returns a miss, queries are issued and the update cache function is called", func(t *testing.T) {
			origShouldCacheQuery := shouldCacheQuery
			var shouldCacheQueryCalled bool
			shouldCacheQuery = func(resp *backend.QueryDataResponse) bool {
				shouldCacheQueryCalled = true
				return true
			}

			t.Cleanup(func() {
				updateCacheCalled = false
				shouldCacheQueryCalled = false
				shouldCacheQuery = origShouldCacheQuery
				cs.Reset()
			})

			cs.ReturnHit = false
			cs.ReturnQueryResponse = dataResponse

			resp, err := cdt.MiddlewareHandler.QueryData(req.Context(), qdr)
			assert.NoError(t, err)
			// Cache service is called once
			cs.AssertCalls(t, "HandleQueryRequest", 1)
			// Equals nil (returned by the decorator test)
			assert.Nil(t, resp)
			// Since it was a miss, the middleware called the update func
			assert.True(t, updateCacheCalled)
			// Since the feature flag was not set, the middleware did not call shouldCacheQuery
			assert.False(t, shouldCacheQueryCalled)
		})

		t.Run("with async queries", func(t *testing.T) {
			asyncCdt := handlertest.NewHandlerMiddlewareTest(t,
				WithReqContext(req, &user.SignedInUser{}),
				handlertest.WithMiddlewares(
					NewCachingMiddlewareWithFeatureManager(cs, featuremgmt.WithFeatures(featuremgmt.FlagAwsAsyncQueryCaching))),
			)
			t.Run("If shoudCacheQuery returns true update cache function is called", func(t *testing.T) {
				origShouldCacheQuery := shouldCacheQuery
				var shouldCacheQueryCalled bool
				shouldCacheQuery = func(resp *backend.QueryDataResponse) bool {
					shouldCacheQueryCalled = true
					return true
				}

				t.Cleanup(func() {
					updateCacheCalled = false
					shouldCacheQueryCalled = false
					shouldCacheQuery = origShouldCacheQuery
					cs.Reset()
				})

				cs.ReturnHit = false
				cs.ReturnQueryResponse = dataResponse

				resp, err := asyncCdt.MiddlewareHandler.QueryData(req.Context(), qdr)
				assert.NoError(t, err)
				// Cache service is called once
				cs.AssertCalls(t, "HandleQueryRequest", 1)
				// Equals nil (returned by the decorator test)
				assert.Nil(t, resp)
				// Since it was a miss, the middleware called the update func
				assert.True(t, updateCacheCalled)
				// Since the feature flag set, the middleware called shouldCacheQuery
				assert.True(t, shouldCacheQueryCalled)
			})

			t.Run("If shoudCacheQuery returns false update cache function is not called", func(t *testing.T) {
				origShouldCacheQuery := shouldCacheQuery
				var shouldCacheQueryCalled bool
				shouldCacheQuery = func(resp *backend.QueryDataResponse) bool {
					shouldCacheQueryCalled = true
					return false
				}

				t.Cleanup(func() {
					updateCacheCalled = false
					shouldCacheQueryCalled = false
					shouldCacheQuery = origShouldCacheQuery
					cs.Reset()
				})

				cs.ReturnHit = false
				cs.ReturnQueryResponse = dataResponse

				resp, err := asyncCdt.MiddlewareHandler.QueryData(req.Context(), qdr)
				assert.NoError(t, err)
				// Cache service is called once
				cs.AssertCalls(t, "HandleQueryRequest", 1)
				// Equals nil (returned by the decorator test)
				assert.Nil(t, resp)
				// Since it was a miss, the middleware called the update func
				assert.False(t, updateCacheCalled)
				// Since the feature flag set, the middleware called shouldCacheQuery
				assert.True(t, shouldCacheQueryCalled)
			})
		})
	})

	t.Run("When CallResource is called", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/resource/blah", nil)
		require.NoError(t, err)

		// This is the response returned by the HandleResourceRequest call
		// Track whether the update cache fn was called, depending on what the response headers are in the cache request
		var updateCacheCalled bool
		dataResponse := caching.CachedResourceDataResponse{
			Response: &backend.CallResourceResponse{
				Status: 200,
				Body:   []byte("bogus"),
			},
			UpdateCacheFn: func(ctx context.Context, rdr *backend.CallResourceResponse) {
				updateCacheCalled = true
			},
		}

		// This is the response sent via the passed-in sender when there is a cache miss
		simulatedPluginResponse := &backend.CallResourceResponse{
			Status: 201,
			Body:   []byte("bogus"),
		}

		cs := caching.NewFakeOSSCachingService()
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			handlertest.WithMiddlewares(NewCachingMiddleware(cs)),
			handlertest.WithResourceResponses([]*backend.CallResourceResponse{simulatedPluginResponse}),
		)

		jsonDataMap := map[string]any{}
		jsonDataBytes, err := json.Marshal(&jsonDataMap)
		require.NoError(t, err)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				JSONData: jsonDataBytes,
			},
		}

		// Populated by clienttest.WithReqContext
		reqCtx := contexthandler.FromContext(req.Context())
		require.NotNil(t, reqCtx)

		crr := &backend.CallResourceRequest{
			PluginContext: pluginCtx,
		}

		var sentResponse *backend.CallResourceResponse
		var storeOneResponseCallResourceSender = backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			sentResponse = res
			return nil
		})

		t.Run("If cache returns a hit, no resource call is issued", func(t *testing.T) {
			t.Cleanup(func() {
				sentResponse = nil
				cs.Reset()
			})

			cs.ReturnHit = true
			cs.ReturnResourceResponse = dataResponse

			err := cdt.MiddlewareHandler.CallResource(req.Context(), crr, storeOneResponseCallResourceSender)
			assert.NoError(t, err)
			// Cache service is called once
			cs.AssertCalls(t, "HandleResourceRequest", 1)
			// The mocked cached response was sent
			assert.NotNil(t, sentResponse)
			assert.Equal(t, dataResponse.Response, sentResponse)
			// Cache was not updated by the middleware
			assert.False(t, updateCacheCalled)
		})

		t.Run("If cache returns a miss, resource call is issued and the update cache function is called", func(t *testing.T) {
			t.Cleanup(func() {
				sentResponse = nil
				cs.Reset()
			})

			cs.ReturnHit = false
			cs.ReturnResourceResponse = dataResponse

			err := cdt.MiddlewareHandler.CallResource(req.Context(), crr, storeOneResponseCallResourceSender)
			assert.NoError(t, err)
			// Cache service is called once
			cs.AssertCalls(t, "HandleResourceRequest", 1)
			// Simulated plugin response was sent
			assert.NotNil(t, sentResponse)
			assert.Equal(t, simulatedPluginResponse, sentResponse)
			// Since it was a miss, the middleware called the update func
			assert.True(t, updateCacheCalled)
		})
	})

	t.Run("When RequestContext is nil", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/doesnt/matter", nil)
		require.NoError(t, err)

		cs := caching.NewFakeOSSCachingService()
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			// Skip the request context in this case
			handlertest.WithMiddlewares(NewCachingMiddleware(cs)),
		)
		reqCtx := contexthandler.FromContext(req.Context())
		require.Nil(t, reqCtx)

		jsonDataMap := map[string]any{}
		jsonDataBytes, err := json.Marshal(&jsonDataMap)
		require.NoError(t, err)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				JSONData: jsonDataBytes,
			},
		}

		t.Run("Query caching is skipped", func(t *testing.T) {
			t.Cleanup(func() {
				cs.Reset()
			})

			qdr := &backend.QueryDataRequest{
				PluginContext: pluginCtx,
			}

			resp, err := cdt.MiddlewareHandler.QueryData(context.Background(), qdr)
			assert.NoError(t, err)
			// Cache service is never called
			cs.AssertCalls(t, "HandleQueryRequest", 0)
			// Equals nil (returned by the decorator test)
			assert.Nil(t, resp)
		})

		t.Run("Resource caching is skipped", func(t *testing.T) {
			t.Cleanup(func() {
				cs.Reset()
			})

			crr := &backend.CallResourceRequest{
				PluginContext: pluginCtx,
			}

			err := cdt.MiddlewareHandler.CallResource(req.Context(), crr, nopCallResourceSender)
			assert.NoError(t, err)
			// Cache service is never called
			cs.AssertCalls(t, "HandleResourceRequest", 0)
		})
	})
}

func TestRequestDeduplicationMiddleware(t *testing.T) {
	t.Run("deduplicates requests issuing the same query", func(t *testing.T) {
		t.Parallel()

		handler := newMockMiddlewareHandler()
		middleware := newRequestDeduplicationMiddleware(handler)

		req := backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					UID: "uid",
				},
			},
		}

		wg := &sync.WaitGroup{}
		wg.Add(2)

		for range 2 {
			go func() {
				defer wg.Done()
				resp, err := middleware.QueryData(t.Context(), &req)
				require.NoError(t, err)
				require.Equal(t, &backend.QueryDataResponse{}, resp)
			}()
		}

		wg.Wait()

		require.EqualValues(t, 1, handler.QueryDataCalls)
	})
}

type mockMiddlewareHandler struct {
	backend.BaseHandler
	QueryDataCalls int32
}

func newMockMiddlewareHandler() *mockMiddlewareHandler {
	return &mockMiddlewareHandler{}
}

func (m *mockMiddlewareHandler) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	atomic.AddInt32(&m.QueryDataCalls, 1)
	time.Sleep(10 * time.Millisecond)
	return &backend.QueryDataResponse{}, nil
}

func TestGetDatasourceID(t *testing.T) {
	t.Parallel()

	cases := []struct {
		desc         string
		settings     backend.DataSourceInstanceSettings
		expectedID   string
		expectedBool bool
	}{
		{
			desc:         "should return uid",
			settings:     backend.DataSourceInstanceSettings{UID: "uid"},
			expectedID:   "uid",
			expectedBool: true,
		},
		{
			desc:         "should return id",
			settings:     backend.DataSourceInstanceSettings{ID: 1},
			expectedID:   "1",
			expectedBool: true,
		},
		{
			desc:         "should not find uid or id",
			settings:     backend.DataSourceInstanceSettings{},
			expectedID:   "",
			expectedBool: false,
		},
	}

	for _, tt := range cases {
		t.Run(tt.desc, func(t *testing.T) {
			id, ok := getDatasourceID(&tt.settings)
			require.Equal(t, tt.expectedBool, ok)
			require.Equal(t, tt.expectedID, id)
		})
	}
}
