# baasbridge

> **Deprecated.** This is a temporary shim. Delete it once the operators that use it serve the plugin v3 gRPC services.

`baasbridge` lets Grafana call an app operator written for `apiextensions-apiserver` as if it were a plugin v3 backend. Such operators serve Kubernetes webhooks and custom routes over HTTP. `baasbridge` wraps that HTTP API in an [`appclientv3.Client`](https://github.com/grafana/grafana-app-sdk/tree/main/plugin/client/v3), the interface Grafana uses for plugin v3 gRPC backends. Everything above the client (unified storage, `kindstore` admission and conversion, `pluginroute` custom routes) works unchanged.

## When it is used

The router's `plugins_url` and `core_url` targets list plugin deployments, each with a `host`:

- A gRPC address such as `widget-operator:10000` gets the normal gRPC plugin clients.
- An `http://` or `https://` URL such as `http://widget-operator:8443` gets a `baasbridge` client. It has no v2 client, so only manifest kinds and routes are served.

See `pluginClients` in `pkg/router/plugin_manifests.go`.

## How v3 calls map to HTTP

| v3 call          | HTTP request to the operator                                    |
| ---------------- | --------------------------------------------------------------- |
| `AdmissionReview` | `POST /mutate`, then `POST /validate`, with an `admission.k8s.io/v1` `AdmissionReview` |
| `ConvertObjects` | `POST /convert` with an `apiextensions.k8s.io/v1` `ConversionReview` |
| `CallRoute`      | The request's method on its own `/apis/<group>/<version>/...` path and query |

These are the endpoints the app-sdk's `k8s.WebhookHandler` registers, and the custom route paths `simple.App` serves.

### Admission needs the manifest

One v3 `AdmissionReview` covers both mutation and validation. The operator serves each at its own endpoint and answers a kind without that hook with a plain-text HTTP 500, which can't be told apart from a real failure. The client therefore reads which hooks each kind and operation declares from the app manifest, and calls only those.

When both hooks are declared, it mutates first: it applies the returned JSON patch and validates the patched object. The v3 admission service behaves the same way.

## Authentication

Requests carry the same credentials that `apiextensions-apiserver` sends:

- **Webhooks** (`/validate`, `/mutate`, `/convert`) carry no caller credentials.
- **Routes** always carry the caller's ID token as `X-Grafana-Id`. They carry the caller's access token as `X-Access-Token` only when no access check declared in the manifest authorized the route, because then the operator authorizes it itself. Tokens are sent raw, without a `Bearer ` prefix.

The router supplies the route credentials through `Options.RouteCredentials`. Any credential or identity-assertion headers on the incoming request are removed first. The client isn't wrapped with v3 token exchange.

## Errors

When the operator can't be reached, or answers a webhook with 503, the client returns gRPC `Unavailable`, as the gRPC client does. The router's circuit breaker counts those against the backend. Route responses pass through with the operator's status code.

## Known gaps

- There is no ID token fallback. `apiextensions-apiserver` derives an ID token from the access token when the caller has none. The router has no deriver, so in that case no `X-Grafana-Id` is sent.
- The router's gRPC request metrics don't cover these calls. They're traced through `otelhttp`.
- There are no per-webhook timeouts. Calls are bounded by the request context.
