## Custom Route Metrics in Grafana API Server

### Problem

Custom API routes registered via `APIGroupRouteProvider.GetAPIRoutes()` bypass the standard Kubernetes apiserver metrics recording middleware. Requests to these routes were not being recorded in `apiserver_request_total`.

**Why this happens:**

```
HTTP Request
    ↓
Gorilla Mux (custom routes) 
    ├─ [MATCHED] → Your custom handler → Response ❌ (no metrics recorded)
    │
    └─ [NOT MATCHED] → k8s DefaultBuildHandlerChain
                           ├─ WithRequestMetrics (records apiserver_request_total) ✅
                           └─ Standard REST storage handlers
```

Custom routes are served by Gorilla Mux and return immediately, never reaching the k8s metrics middleware.

### Solution

We've implemented **centralized automatic instrumentation** that records custom route requests in the **same `apiserver_request_total` metric** used by standard Kubernetes API calls. This means:

- ✅ **Single metric** for all API requests (standard + custom routes)
- ✅ **Consistent labels** matching Kubernetes conventions
- ✅ **No dashboard changes** needed - existing queries work
- ✅ **Automatic** for all API servers with zero code changes

#### Key Components

1. **`pkg/services/apiserver/builder/custom_route_metrics.go`**
   - Defines `CustomRouteMetrics` 
   - Uses the existing `apiserver_request_total` metric (via `metrics.MonitorRequest`)
   - Provides `responseWriterWithStatus` to capture HTTP status codes
   - Provides `InstrumentHandler()` to wrap route handlers

2. **`pkg/services/apiserver/builder/request_handler.go`**
   - Updated `GetCustomRoutesHandler()` to accept `prometheus.Registerer`
   - Automatically instruments ALL custom routes (both root and namespace)
   - Works transparently for all API servers

3. **Updated signatures**
   - `BuildHandlerChainFuncFromBuilders`: now accepts `prometheus.Registerer`
   - `GetDefaultBuildHandlerChainFunc`: now accepts `prometheus.Registerer`
   - `SetupConfig`: now accepts `prometheus.Registerer`
   - Factory interfaces updated to pass registry through

### Usage

**For new API servers:** No action required! Custom routes are automatically instrumented.

**For existing API servers:** No changes needed. All API servers using `APIGroupRouteProvider` automatically get metrics.

### Metrics

Query in Prometheus - **same metric as standard API calls**:

```promql
# Total requests by status code (includes both standard REST and custom routes)
sum by (code)(rate(apiserver_request_total{group="provisioning.grafana.app"}[$__rate_interval]))

# Requests by resource and status
sum by (resource, code)(rate(apiserver_request_total{group="provisioning.grafana.app"}[$__rate_interval]))

# Error rate (4xx + 5xx)
sum(rate(apiserver_request_total{group="provisioning.grafana.app", code=~"[45].."}[$__rate_interval]))
/ 
sum(rate(apiserver_request_total{group="provisioning.grafana.app"}[$__rate_interval]))

# Custom routes specifically (filter by resource name)
sum by (resource, code)(rate(apiserver_request_total{
  group="provisioning.grafana.app",
  resource=~"stats|settings"  # custom route resources
}[$__rate_interval]))
```

### Example

For a custom route like `/apis/provisioning.grafana.app/v0alpha1/namespaces/default/settings`:

```go
func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
    return &builder.APIRoutes{
        Namespace: []builder.APIRouteHandler{
            {
                Path: "settings",
                Handler: b.handleSettings, // Automatically instrumented!
            },
        },
    }
}
```

Metrics recorded in `apiserver_request_total`:
```
apiserver_request_total{
  verb="GET",
  dry_run="",
  group="provisioning.grafana.app",
  version="v0alpha1",
  resource="settings",
  subresource="",
  scope="namespace",
  component="",
  code="200"
} 1

apiserver_request_total{
  verb="GET",
  dry_run="",
  group="provisioning.grafana.app",
  version="v0alpha1",
  resource="settings",
  subresource="",
  scope="namespace",
  component="",
  code="401"
} 1
```

### Implementation Details

The `responseWriterWithStatus` wrapper:
- Wraps `http.ResponseWriter` to intercept `WriteHeader()` and `Write()` calls
- Captures the status code before the response is sent
- Defaults to 200 if `WriteHeader()` is never called
- Works with `errhttp.Write()`, manual `WriteHeader()`, and implicit status codes

### API Servers with Custom Routes

Currently instrumented (as of October 2025):
1. `provisioning.grafana.app` - stats, settings
2. `querylibrary.grafana.app`
3. `queries.grafana.app`
4. `alertenrichment.grafana.app`
5. `scim.grafana.app`
6. `dashboard.grafana.app`
7. `iam.grafana.app`
8. `ofrep.grafana.app`
9. `dashboardsnapshot.grafana.app`

All of these automatically get metrics with no code changes required.

### Testing

To verify metrics are working:

1. Make requests to custom routes
2. Check Prometheus:
   ```promql
   apiserver_custom_route_requests_total
   ```
3. You should see metrics with proper status codes (200, 401, 404, 500, etc.)

### Future Improvements

- Add request duration histogram
- Add request size histogram
- Add response size histogram
- Align label names with standard Kubernetes metrics
