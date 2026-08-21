# Investigation: ~240s Timeout in CallResource SSE Stream Proxy

## Summary

**No explicit 240-second (4-minute) timeout was found anywhere in Grafana core's CallResource proxy path.** The ~240s cutoff is NOT caused by a hardcoded constant in grafana/grafana.

---

## Detailed Findings

### 1. Search for 240s / 4×time.Minute / 240×time.Second

**Result: Not found in any plugin-related code path.**

The only `4 * time.Minute` values in the repository are:
- `pkg/storage/unified/resource/kv_backend_options_test.go:134` — `SearchLookback` test value
- `pkg/storage/unified/resource/storage_backend_test.go:4102` — `maxEventReplayAge` test assertion
- `pkg/services/ngalert/state/persister_sync_test.go:150` — test fixture timestamp

None are in the CallResource, plugin proxy, or gRPC plugin client paths.

---

### 2. gRPC Client-Side Deadline / Keepalive

**Result: No per-request timeout or deadline is applied.**

The gRPC call for CallResource at:
- **`pkg/plugins/backendplugin/grpcplugin/client_v2.go:275-308`** — `ClientV2.CallResource()` passes the context directly through:
  ```go
  protoStream, err := c.ResourceClient.CallResource(ctx, protoReq)
  ```
- **`pkg/plugins/backendplugin/grpcplugin/client_proto.go:126-132`** — passes `ctx` straight to the underlying gRPC client
- **`pkg/plugins/backendplugin/grpcplugin/client.go:69-77`** — `GRPCDialOptions` only includes an OTEL stats handler, no keepalive or timeout options

The hashicorp/go-plugin library (`v1.7.0`):
- `grpc_client.go:20-54` — `dialGRPCConn()` sets no keepalive or per-call timeout
- `client.go:754` — creates `doneCtx` with `context.WithCancel(context.Background())` (no deadline, only canceled on plugin exit)
- Only timeout: `StartTimeout` (1 minute) for the initial plugin startup handshake

grpc-go defaults (`google.golang.org/grpc@v1.79.1`, `internal/transport/defaults.go`):
- `defaultClientKeepaliveTime` = infinity
- `defaultMaxConnectionIdle` = infinity  
- `defaultMaxConnectionAge` = infinity
- `defaultServerKeepaliveTime` = 2 hours

The grafana-plugin-sdk-go (`v0.292.1`):
- `backend/grpcplugin/grpc_resource.go:56-58` — passes `ctx` directly, no timeout wrapper
- `backend/serve.go:146-169` — gRPC server options include only recv/send message size, prometheus metrics, otel, and panic recovery. No keepalive params.

---

### 3. HTTP Server Timeouts

**Result: No WriteTimeout is set. ReadTimeout defaults to 0 (infinite).**

- **`pkg/api/http_server.go:469-473`**:
  ```go
  hs.httpSrv = &http.Server{
      Addr:        net.JoinHostPort(host, hs.Cfg.HTTPPort),
      Handler:     hs.web,
      ReadTimeout: hs.Cfg.ReadTimeout,
  }
  ```
  - `ReadTimeout` comes from `pkg/setting/setting.go:2397`: `cfg.ReadTimeout = server.Key("read_timeout").MustDuration(0)`
  - Default in `conf/defaults.ini:105`: `read_timeout = 0` (no timeout)
  - **No `WriteTimeout`** is set (Go net/http default = 0 = infinite)
  - **No `IdleTimeout`** is set (defaults to `ReadTimeout` = 0 = infinite)

- **No `http.TimeoutHandler`** is used anywhere in the Grafana codebase for plugin resource routes.

---

### 4. CallResource vs QueryData Context Deadlines

**Result: Neither CallResource nor QueryData applies a default timeout to the request context.**

- **CallResource entry point** (`pkg/api/plugin_resource.go:27-53`):
  - Uses `c.Req.Context()` directly (the incoming HTTP request context)
  - No `context.WithTimeout` or `context.WithDeadline` wrapper

- **Plugin client middleware** (`pkg/services/pluginsintegration/clientmiddleware/`):
  - All middlewares (cookies, user header, tracing, caching, metrics, OAuth, forward ID, clear auth headers) pass the context through unchanged
  - None apply `context.WithTimeout` or `context.WithDeadline`

- **Plugin manager client** (`pkg/plugins/manager/client/client.go:114-159`):
  - `CallResource()` calls `p.CallResource(ctx, req, wrappedSender)` with the unmodified context

- **Context handler** (`pkg/services/contexthandler/contexthandler.go:88-127`):
  - Only adds values to context (`context.WithValue`), never adds a deadline

- **No constant** like `DefaultCallResourceTimeout` or `resourceRequestTimeout` exists in the codebase.

---

### 5. What DOES Apply to the Request Context

The only thing that would cancel the context for a `/api/plugins/:pluginId/resources/*` request is:
1. **Client disconnect** — the HTTP client closes the connection (net/http cancels the context)
2. **Server shutdown** — Grafana's HTTP server shuts down

There is no server-side deadline applied to CallResource requests within Grafana core.

---

### 6. K8s Apiserver Path (NOT applicable to app plugin CallResource)

The k8s apiserver request timeout (`pkg/services/apiserver/options/extra.go:40`):
```go
RequestTimeout: 10 * time.Minute,
```
applies only to requests routed through the k8s apiserver handler chain (`/apis/` prefix). The `/api/plugins/:pluginId/resources/*` route is served by Grafana's traditional HTTP server and does NOT pass through this filter.

---

## Conclusion & Likely Source of ~240s Timeout

The ~240s timeout is **not present in grafana/grafana core**. Based on this investigation, the source must be in one of:

1. **The hosted-grafana infrastructure layer** — something between the external client and Grafana's process (a load balancer, sidecar proxy, service mesh timeout, or container orchestration probe) that isn't visible in this repo.

2. **The plugin gateway** — if grafana-assistant-app runs as a hosted/remote plugin via a plugin gateway service (separate repo like `grafana/plugin-gateway`), that gateway may have its own gRPC or HTTP timeout for streaming RPCs.

3. **The go-plugin connection over a network** — in hosted Grafana, if plugins run in separate containers/pods connected over a network (not a local unix socket), there could be a network-level timeout (TCP keepalive, kernel `tcp_keepalive_time`, or a service mesh idle connection timeout) that triggers at ~240s of no TCP-level activity (if the SSE stream has a period of silence).

4. **A reverse proxy between the browser and Grafana** — while you confirmed the gateway `server_write_timeout=300s` and Cloudflare `proxy_read_timeout=301s`, there may be an intermediate component (ingress controller, GKE internal load balancer, or Istio/Envoy sidecar) with a 240s idle timeout that hasn't been identified yet.

The fact that the gRPC error is "context canceled" (not "context deadline exceeded") strongly suggests the cancellation comes from the HTTP client connection being severed by an intermediate proxy, causing Go's net/http to cancel the request context, which propagates down to the gRPC stream.
