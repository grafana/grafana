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
4. For OSS APIs only: Registers Redux reducers and middleware in the store. For Enterprise this needs to be done manually
5. Formats all generated files using Prettier and ESLint
6. Automatically runs the appropriate command to generate endpoints from the OpenAPI schema

## Limitations

- The generator is optimized for Kubernetes-style APIs, as it requires Kubernetes resource details. For legacy APIs, manual adjustments may be needed.
- It expects processed OpenAPI specifications to exist in the `openapi_snapshots` directory

## Troubleshooting

### Missing OpenAPI Schema

If an error about a missing OpenAPI schema appears, check that:

1. The API group and version exist in the backend
2. The `TestIntegrationOpenAPIs` test has been run to generate the schema (step 1 in the [main API documentation](../README.md)).
3. The schema file exists at `data/openapi/<group>-<version>.json`

### Validation Errors

- API group must include `.grafana.app`
- Version must be in format `v0alpha1`, `v1beta2`, etc.
- Reducer path must end with `API`
