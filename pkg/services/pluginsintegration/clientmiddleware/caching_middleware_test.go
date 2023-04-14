package clientmiddleware

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/caching"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCachingMiddleware(t *testing.T) {
	t.Run("When QueryData is called", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/query", nil)
		require.NoError(t, err)

		cs := caching.NewFakeOSSCachingService()
		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithReqContext(req, &user.SignedInUser{}),
			clienttest.WithMiddlewares(NewCachingMiddleware(cs)),
		)

		jsonDataMap := map[string]interface{}{}
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

			resp, err := cdt.Decorator.QueryData(req.Context(), qdr)
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
			t.Cleanup(func() {
				updateCacheCalled = false
				cs.Reset()
			})

			cs.ReturnHit = false
			cs.ReturnQueryResponse = dataResponse

			resp, err := cdt.Decorator.QueryData(req.Context(), qdr)
			assert.NoError(t, err)
			// Cache service is called once
			cs.AssertCalls(t, "HandleQueryRequest", 1)
			// Equals nil (returned by the decorator test)
			assert.Nil(t, resp)
			// Since it was a miss, the middleware called the update func
			assert.True(t, updateCacheCalled)
		})
	})

	t.Run("When CallResource is called", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/resource/blah", nil)
		require.NoError(t, err)

		cs := caching.NewFakeOSSCachingService()
		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithReqContext(req, &user.SignedInUser{}),
			clienttest.WithMiddlewares(NewCachingMiddleware(cs)),
		)

		jsonDataMap := map[string]interface{}{}
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

		resourceResponse := &backend.CallResourceResponse{
			Status: 200,
			Body:   []byte("bogus"),
		}

		var sentResponse *backend.CallResourceResponse
		var storeOneResponseCallResourceSender = callResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			sentResponse = res
			return nil
		})

		t.Run("If cache returns a hit, no resource call is issued", func(t *testing.T) {
			t.Cleanup(func() {
				sentResponse = nil
				cs.Reset()
			})

			cs.ReturnHit = true
			cs.ReturnResourceResponse = resourceResponse

			err := cdt.Decorator.CallResource(req.Context(), crr, storeOneResponseCallResourceSender)
			assert.NoError(t, err)
			// Cache service is called once
			cs.AssertCalls(t, "HandleResourceRequest", 1)
			// Equals the mocked response was sent
			assert.NotNil(t, sentResponse)
			assert.Equal(t, resourceResponse, sentResponse)
		})

		t.Run("If cache returns a miss, resource call is issued", func(t *testing.T) {
			t.Cleanup(func() {
				sentResponse = nil
				cs.Reset()
			})

			cs.ReturnHit = false
			cs.ReturnResourceResponse = resourceResponse

			err := cdt.Decorator.CallResource(req.Context(), crr, storeOneResponseCallResourceSender)
			assert.NoError(t, err)
			// Cache service is called once
			cs.AssertCalls(t, "HandleResourceRequest", 1)
			// Nil response was sent
			assert.Nil(t, sentResponse)
		})
	})

	t.Run("When RequestContext is nil", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/doesnt/matter", nil)
		require.NoError(t, err)

		cs := caching.NewFakeOSSCachingService()
		cdt := clienttest.NewClientDecoratorTest(t,
			// Skip the request context in this case
			clienttest.WithMiddlewares(NewCachingMiddleware(cs)),
		)
		reqCtx := contexthandler.FromContext(req.Context())
		require.Nil(t, reqCtx)

		jsonDataMap := map[string]interface{}{}
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

			resp, err := cdt.Decorator.QueryData(context.Background(), qdr)
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

			err := cdt.Decorator.CallResource(req.Context(), crr, nopCallResourceSender)
			assert.NoError(t, err)
			// Cache service is never called
			cs.AssertCalls(t, "HandleResourceRequest", 0)
		})
	})
}
