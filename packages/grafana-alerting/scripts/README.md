# Re-generate the clients

⚠️ This guide assumes the Backend definitions have been updated in `apps/alerting`.

## Re-create OpenAPI specification

Start with re-generating the OpenAPI snapshots by running the test in `pkg/tests/apis/openapi_test.go`.

This will output the OpenAPI JSON spec file(s) in `pkg/tests/apis/openapi_snapshots`.

## Process OpenAPI specifications

Next up run the post-processing of the snapshots with `yarn run process-specs`, this will copy processed specifications to `./data/openapi/`.

## Generate RTKQ files

These files are built using the `yarn run codegen` command, make sure to run that in the Grafana Alerting package working directory.

`yarn --cwd ./packages/grafana-alerting run codegen`.

API clients will be written to `src/grafana/api/<version>/api.gen.ts`.

Make sure to create a versioned API client for each API version – see `src/grafana/api/v0alpha1/api.ts` as an example.
