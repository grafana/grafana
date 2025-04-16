# RTK Query API Client Generator

This generator automates the process of creating RTK Query API clients for Grafana's API groups. It replaces the manual steps outlined in the [main API documentation](../README.md).

## Usage

```bash
yarn generate:api-client
```

The CLI will prompt for:

1. **Enterprise or OSS API** - Whether this is an Enterprise or OSS API. This affects paths and build commands.
2. **API group name** - The basic name for the API (e.g., `dashboard`)
3. **API group** - The full API group name (defaults to `<group-name>.grafana.app`)
4. **API version** - The API version (e.g., `v0alpha1`)
5. **Reducer path** - The Redux reducer path (defaults to `<group-name>API`). This will also be used as the API's named export.
6. **Endpoints** - Optional comma-separated list of endpoints to include (e.g., `createDashboard,updateDashboard`). If not provided, all endpoints will be included.

## What It Does

The generator automates the following:

1. Creates the `baseAPI.ts` file for the API group
2. Updates the appropriate generate script to include the API client
   - `scripts/generate-rtk-apis.ts` for OSS APIs
   - `local/generate-enterprise-apis.ts` for Enterprise APIs
3. Creates the `index.ts` file with proper exports
4. Updates Redux reducers and middleware in the store
5. Formats all generated files using Prettier and ESLint
6. Automatically runs the appropriate command to generate endpoints from the OpenAPI schema

## Path Differences

Depending on the selection at the start:

### OSS APIs
- Client path: `public/app/api/clients/<group-name>/`
- Generation script: `scripts/generate-rtk-apis.ts`
- Build command: `yarn generate-apis`

### Enterprise APIs
- Client path: `public/app/extensions/api/clients/<group-name>/`
- Generation script: `local/generate-enterprise-apis.ts`
- Build command: `yarn process-specs && npx rtk-query-codegen-openapi ./local/generate-enterprise-apis.ts`

## Example

```bash
$ yarn generate:api-client

? Is this an Enterprise API? No
? API group name (e.g. dashboard): dashboard
? API group (e.g. dashboard.grafana.app): dashboard.grafana.app
? API version (e.g. v0alpha1): v0alpha1
? Reducer path (e.g. dashboardAPI): dashboardAPI
? Endpoints to include (comma-separated): createDashboard,updateDashboard
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

If an error about a missing OpenAPI schema appears, check that:

1. The API group and version exist in the backend
2. The `TestIntegrationOpenAPIs` test has been run to generate the schema
3. The schema file exists at `data/openapi/<group>-<version>.json`

### Validation Errors

- API group must include `.grafana.app`
- Version must be in format `v0alpha1`, `v1beta2`, etc.
- Reducer path must end with `API`
