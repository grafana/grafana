## Migrate to Cloud API

The [`endpoints.gen.ts`](./endpoints.gen.ts) file is machine generated. In order to update it, follow these steps:

- Run: `make swagger-clean && make openapi3-gen`
- Run: `yarn generate-apis`

If you run into issues, try updating your Node.js version.
