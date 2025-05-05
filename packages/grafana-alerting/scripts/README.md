These files are built concurrently using the `yarn run codegen` command, duplicate any of the existing config files and adapt as necessary to build the RTKQ API clients.

API clients will be written to `src/grafana/api/api.<version>.gen.ts`.

Make sure to create a versioned API client for each API version – see `src/grafana/api/api.v0alpha1.ts` as an example.
