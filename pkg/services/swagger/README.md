# Swagger

This package serves `/swagger`, the Swagger-based navigator for the Grafana HTTP API.

It runs in one of two modes. Both use the same `Handler`, so the page is the same in either mode:

- **On the core HTTP server.** This is what `target = all` (the default) does. `ProvideService` registers the routes on the core `RouteRegister` through Wire.
- **Standalone**, under the `swagger-server` target. This mode runs its own HTTP server and is meant for deployments that serve the page separately from the API.

## Files

| File                     | Contents                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `handler.go`             | Renders the page from the embedded `swagger.html`, and registers the routes on the core server.                                          |
| `swagger_service.go`     | The standalone dskit service: its HTTP server, middleware chain and routes.                                                              |
| `context_middleware.go`  | Adds a minimal `ReqContext` to each request, which holds the CSP nonce and the request logger.                                           |
| `recovery_middleware.go` | Turns a panic into a 500. `middleware.Recovery` can't be used here because it needs the template set from `web.Renderer`, which this service doesn't install. |

## Running the standalone server

From the repository root:

```bash
go run ./pkg/cmd/grafana server target --homepath=$PWD cfg:target=swagger-server
```

Or, with a binary built by `make build-backend`:

```bash
./bin/grafana server target --homepath=$PWD cfg:target=swagger-server
```

The page is then at http://localhost:3000/swagger.

You must use the `target` subcommand. Plain `grafana server` always starts the full server and ignores `target`, which is also why `make run` can't start this service. `cfg:` overrides are applied after `conf/custom.ini` is read, so you don't need to change any config files.

The service listens on `[server] http_port`, the same setting the core server uses. If Grafana is already running, add a free port, for example `cfg:server.http_port=3009`.

### Frontend assets

The page loads its bundle from `public/build-swagger`, which the normal frontend dev server doesn't build. Run `yarn build:swagger` once, or `yarn start:swagger` to rebuild on change. Without the bundle, `/swagger` returns a 500.

## Routes

| Route         | Description                                  |
| ------------- | -------------------------------------------- |
| `/swagger`    | The API navigator                            |
| `/swagger-ui` | Deprecated, redirects to `/swagger`          |
| `/openapi3`   | Deprecated, redirects to `/swagger`          |
| `/public/*`   | The swagger bundle and the OpenAPI spec files |
| `/metrics`    | Prometheus metrics (standalone only)         |
| `/-/health`   | Liveness check (standalone only)             |

## Deploying separately

The page also requests `/openapi/v3`, `/api/frontend/settings` and `/api/user` (see `public/swagger/SwaggerPage.tsx`). The Grafana API serves those, not this service. A standalone deployment therefore needs a proxy that sends `/swagger` and `/public` here and the API paths to the core server, the same setup the frontend service (`pkg/services/frontend`) uses. Without the proxy, the page still renders, but the API selector and user panes stay empty.
