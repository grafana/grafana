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

These are the endpoints the app-sdk's `k8s.WebhookHandler` registers, and the custom route paths `simple.App` serves. Those paths can be even for bespoke backends, rather than ones created with app-sdk or k8s webhook handlers. An operator that serves its webhooks elsewhere names them in the manifest's `operator.webhooks` (`mutationPath`, `validationPath`, `conversionPath`), as for `apiextensions-apiserver`. A missing or empty path uses the default.

### Admission needs the manifest

One v3 `AdmissionReview` covers both mutation and validation. The operator serves each at its own endpoint and answers a kind without that hook with a plain-text HTTP 500, which can't be told apart from a real failure. The client therefore reads which hooks each kind and operation declares from the app manifest, and calls only those.

When both hooks are declared, it mutates first: it applies the returned JSON patch and validates the patched object. The v3 admission service behaves the same way.

Like `apiextensions-apiserver`, each admission call:

- names the caller, as the API server authenticated them, in `request.userInfo`;
- times out after 10 seconds, the Kubernetes default `timeoutSeconds`.

A conversion response must name the request's UID and report `Success`, or the conversion fails.

## Authentication

Requests carry the same credentials that `apiextensions-apiserver` sends:

- **Webhooks** carry no caller credentials. Admission reviews still identify the caller in `request.userInfo`.
- **Routes** always carry the caller's ID token as `X-Grafana-Id`. They carry the caller's access token as `X-Access-Token` only when no access check declared in the manifest authorized the route, because then the operator authorizes it itself. Tokens are sent raw, without a `Bearer ` prefix.

The router supplies the route credentials through `Options.RouteCredentials`. Any credential or identity-assertion headers on the incoming request are removed first. The client isn't wrapped with v3 token exchange.

## Errors

When the operator can't be reached, or answers a webhook with 503, the client returns gRPC `Unavailable`. An admission call that times out returns `DeadlineExceeded`, as does any call whose response headers take longer than the router's backend response-header timeout (60s). That timeout covers only the headers, so a watch's body can stream for as long as it lasts. The gRPC client uses the same codes, and the router's circuit breaker counts both against the backend. Route responses pass through with the operator's status code. Their status and headers are relayed before any body, so a watch's headers aren't held until its first event.

Redirects are never followed, because that would carry the caller's credentials to the redirect target. A route redirect becomes a 502, as from the router's proxies, and doesn't count against the breaker. A webhook redirect fails the call.

## Known gaps

- There is no ID token fallback. `apiextensions-apiserver` derives an ID token from the access token when the caller has none. The router has no deriver, so in that case no `X-Grafana-Id` is sent.
- The router's gRPC request metrics don't cover these calls. They're traced through `otelhttp`.
- Admission reviews don't set `dryRun`, because the v3 request doesn't carry it. An operator with side effects can't skip them for a dry run.
- Calls aren't retried. The gRPC client retries `Unavailable` up to three times. `apiextensions-apiserver` only retries webhook responses that carry a `Retry-After` header, which the app-sdk webhook handler never sends.

## Removing it

Everything outside this package that uses it is marked `//nolint:staticcheck`, because the package is deprecated. Deleting the package breaks the build at each of these:

- `pkg/router/plugin_manifests.go`: picks the bridge for HTTP hosts, and forwards route credentials.
- `pkg/router/plugin.go`: skips v3 token exchange for bridge clients.
- `pkg/services/pluginsintegration/pluginroute/routes.go`: calls `WithDeclaredAccessChecked` once a declared access check passes, which decides whether a route gets the caller's access token.
