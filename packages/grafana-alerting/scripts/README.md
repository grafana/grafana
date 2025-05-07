These files are built using the `yarn run codegen` command.
API clients will be written to `src/grafana/api/<version>/api.gen.ts`.

Make sure to create a versioned API client for each API version – see `src/grafana/api/v0alpha1/api.ts` as an example.
