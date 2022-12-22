## What

This aims to define the unified alerting API as code. It generates OpenAPI definitions from go structs. It also generates server/route stubs based on our documentation.

## Running

`make` - regenerate everything - documentation and server stubs.
`make serve` - regenerate the Swagger document, and host rendered docs on port 80. [view api](http://localhost)

## Requires
 - [go-swagger](https://github.com/go-swagger/go-swagger)
 - [goimports](https://pkg.go.dev/golang.org/x/tools/cmd/goimports)

## Why

The current state of Swagger extraction from golang is relatively limited. It's easier to generate server stubs from an existing Swagger doc, as there are limitations with producing a Swagger doc from a hand-written API stub. The current extractor instead relies on comments describing the routes, but the comments and actual implementation may drift, which we don't want to allow.

Instead, we use a hybrid approach - we define the types in Golang, with comments describing the routes, in a standalone package with minimal dependencies. From this, we produce a Swagger doc, and then turn the Swagger doc back into a full-blown server stub.

### Stability

We have some endpoints that we document publically as being stable, and others that we consider unstable. The stable endpoints are documented in `api.json`, where all endpoints are available in `post.json`.

To stabilize an endpoint, add the `stable` tag to its route comment:

```
// swagger:route GET /api/provisioning/contact-points provisioning stable RouteGetContactpoints
```
