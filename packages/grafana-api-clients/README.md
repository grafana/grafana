# Grafana API Clients

> **@grafana/api-clients is currently in ALPHA**.

This package provides reusable clients for Grafana APIs. The implementation is in ALPHA and the package is now published on npm as `@grafana/api-clients`.

The clients are auto-generated [RTK Query](https://redux-toolkit.js.org/rtk-query/overview) API clients for Grafana's App Platform APIs.

## Installation

```bash
yarn add @grafana/api-clients
```

## TypeScript configuration

This package uses [subpath exports](https://nodejs.org/api/packages.html#subpath-exports), which require `moduleResolution` to be set to `"bundler"` in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

If you use ts-node, add the following to your `tsconfig.json`:

```json
{
  "ts-node": {
    "compilerOptions": {
      "module": "es2020",
      "moduleResolution": "Bundler"
    }
  }
}
```

## Usage

Each API client is available as a separate subpath export, scoped by group and version:

```ts
import { generatedAPI } from '@grafana/api-clients/rtkq/<group>/<version>';
```

For example, to use the dashboard API or a hook:

```ts
import { generatedAPI, useListDashboardsQuery } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
```

### Adding RTKQ middleware to your Redux store

If you're using this package in the context of the Grafana application, the middleware is already added for all API clients, so you don't need to add it manually.
If you're using this package for something else, outside of the core Grafana UI, you can add the middleware and reducers to your Redux store by importing the `allMiddleware` and `allReducers` exports.

```ts
import { allMiddleware, allReducers } from '@grafana/api-clients/rtkq';

const store = configureStore({
  reducer: {
    ...allReducers,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(...allMiddleware),
});
```

# Development (within `grafana/grafana`)

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

Afterwards, you need to run the `TestIntegrationOpenAPIs` test with `go test ./pkg/tests/apis -run TestIntegrationOpenAPIs`. Note that it will fail the first time you run it. On the second run, it will generate the corresponding OpenAPI spec, which you can find in [openapi_snapshots](../../pkg/tests/apis/openapi_snapshots).

> Note: You don't need to follow these two steps if the `group` you're working with is already in the `openapi_test.go` file.

### 2. Run the API generator script

Run `yarn generate:api-client` and follow the prompts. See [API Client Generator](./src/generator/README.md) for details.

## Updating generated clients

To update the existing clients, for example, when the OpenAPI spec has changed, run `go test ./pkg/tests/apis -run TestIntegrationOpenAPIs`, followed by `yarn generate-apis`. This will regenerate all the clients based on the current OpenAPI snapshots.
