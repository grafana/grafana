# Swagger

This package serves `/swagger`, the Swagger-based navigator for Grafana's HTTP API.

It can run two ways, both backed by the same handler so the page is identical either way:

- Mounted on the core HTTP server, which is what `target = all` (the default) does. See `registerSwaggerUI` in `pkg/api/swagger.go`.
- As a standalone dskit service under the `swagger-server` target, for deployments that run it separately from the API.

## Structure

- `handler.go`: renders the page. `NewHandler` is the entry point shared by both modes; `swagger.html` is embedded, so rendering does not depend on the core server's template renderer.
- `swagger_service.go`: the dskit service — an HTTP server, its middleware chain, and the routes the standalone target serves.
- `context_middleware.go`: attaches a minimal `ReqContext` to each request, which is where the CSP middleware stores the per-request nonce.
- `recovery_middleware.go`: turns a panic into a 500. `middleware.Recovery` is not usable here because it renders its error page through the template set `web.Renderer` installs, which this service does not have.

## Running the standalone server

The target is selected with `cfg:target=swagger-server` on the command line. This is applied after `conf/custom.ini` is read, so it overrides whatever `target` that file sets — no config file changes are needed.

```bash
go run ./pkg/cmd/grafana server target --homepath=$PWD cfg:target=swagger-server
```

Or against a compiled binary (`make build-backend`):

```bash
./bin/grafana server target --homepath=$PWD cfg:target=swagger-server
```

The page is then at http://localhost:3000/swagger.

Note the `target` subcommand: plain `grafana server` always starts the full monolith and ignores `target` entirely. For the same reason `make run` cannot start this service — `.air.toml` hardcodes the `server` command.

### Choosing a port

The service listens on the standard `[server] http_port`, the same key the core server uses, so pick a free one if a normal Grafana is already running:

```bash
go run ./pkg/cmd/grafana server target --homepath=$PWD \
  cfg:target=swagger-server \
  cfg:server.http_port=3009
```

Any setting can be overridden this way, using `cfg:<section>.<key>=<value>` (drop the section for keys outside one, as `target` is).

### Frontend assets

The page loads its bundle from `public/build-swagger`, which is not part of the normal frontend dev server output. Build it once with `yarn build:swagger`, or run `yarn start:swagger` to rebuild it on change. Without it `/swagger` returns a 500, because the assets manifest cannot be read.

## Routes

| Route         | Description                                            |
| ------------- | ------------------------------------------------------ |
| `/swagger`    | The API navigator                                      |
| `/swagger-ui` | Deprecated, redirects to `/swagger`                    |
| `/openapi3`   | Deprecated, redirects to `/swagger`                    |
| `/public/*`   | The swagger bundle and the OpenAPI spec files it reads |
| `/metrics`    | Prometheus metrics                                     |
| `/-/health`   | Liveness check for orchestrators                       |

## Deploying it separately

The page also fetches `/openapi/v3`, `/api/frontend/settings` and `/api/user` relative to the root (see `public/swagger/SwaggerPage.tsx`). Those are served by the Grafana API, not by this service, so a standalone deployment needs a proxy routing `/swagger` and `/public` here and the API paths to the core server. This is the same arrangement the frontend service (`pkg/services/frontend`) relies on. Running it standalone without such a proxy renders the page, but the API selector and user panes stay empty.
