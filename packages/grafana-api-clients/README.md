# Grafana API Clients

> **@grafana/api-clients is currently in BETA**.

This package hosts reusable clients for Grafana APIs. The implementation is currently in BETA and not yet published.

## Generating RTK Query API Clients

This guide explains how to generate API clients for Grafana APIs using this package.

### 1. Generate an OpenAPI snapshot

First, check if the `group` and the `version` are already present in [openapi_test.go](../../pkg/tests/apis/openapi_test.go). If so, move on to the next step. If you need to add a new block, you can check for the right `group` and `version` in the backend API call that you want to replicate in the frontend.

```go
{
  Group:   "dashboard.grafana.app",
  Version: "v0alpha1",
}
```

Afterwards, you need to run the `TestIntegrationOpenAPIs` test. Note that it will fail the first time you run it. On the second run, it will generate the corresponding OpenAPI spec, which you can find in [openapi_snapshots](../../pkg/tests/apis/openapi_snapshots).

> Note: You don't need to follow these two steps if the `group` you're working with is already in the `openapi_test.go` file.

### 2. Run the API generator script

Run `yarn generate:api-client` and follow the prompts. See [API Client Generator](./src/generator/README.md) for details.

## Updating generated clients

To update the existing clients, for example, when the OpenAPI spec has changed, run `yarn generate-apis`. This will regenerate all the clients based on the current OpenAPI snapshots.
