# RTK Query API Client Generator

This generator automates the process of creating RTK Query API clients for Grafana's API groups. It replaces the manual steps outlined in the main API documentation.

## Usage

```bash
yarn generate:api-client
```

This will prompt you for:

1. **API group name** - The basic name for your API (e.g., `dashboard`)
2. **API group** - The full API group name (defaults to `<group-name>.grafana.app`)
3. **API version** - The API version (e.g., `v0alpha1`)
4. **Reducer path** - The Redux reducer path (defaults to `<group-name>API`)
5. **Operation IDs** - Comma-separated list of operation IDs to include (e.g., `createDashboard,updateDashboard`)

## What It Does

The generator automates the following:

1. Creates the `baseAPI.ts` file for your API group
2. Updates `generate-rtk-apis.ts` to include your API client
3. Creates the `index.ts` file with proper exports
4. Updates Redux reducers and middleware in the store
5. Automatically runs `yarn generate-apis` to generate endpoints from the OpenAPI schema

## Example

```bash
$ yarn generate:api-client

? API group name (e.g. dashboard): dashboard
? API group (e.g. dashboard.grafana.app): dashboard.grafana.app
? API version (e.g. v0alpha1): v0alpha1
? Reducer path (e.g. dashboardAPI): dashboardAPI
? Operation IDs to include (comma-separated): createDashboard,updateDashboard
```

This will generate:

- `public/app/api/clients/dashboard/baseAPI.ts`
- `public/app/api/clients/dashboard/endpoints.gen.ts` (automatically generated)
- `public/app/api/clients/dashboard/index.ts`

And update:

- `scripts/generate-rtk-apis.ts`
- `public/app/core/reducers/root.ts`
- `public/app/store/configureStore.ts`

## Troubleshooting

### Missing OpenAPI Schema

If you see an error about a missing OpenAPI schema, make sure:

1. The API group and version exist in the backend
2. You've run `TestIntegrationOpenAPIs` test to generate the schema
3. The schema file exists at `data/openapi/<group>-<version>.json`

### Validation Errors

- API group must include `.grafana.app`
- Version must be in format `v0alpha1`, `v1beta2`, etc.
- Reducer path must end with `API`
- At least one operation ID must be provided

### Generation Failed

If endpoint generation fails:

1. Check the error message from `yarn generate-apis`
2. Verify that the OpenAPI schema contains the operation IDs you specified
3. Try running `yarn generate-apis` manually
