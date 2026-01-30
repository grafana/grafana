## Dashboard migration guide
[Dashboard Migration Guide](./migration/README.md)


## How to make updates to schema
### Updating v1 and v0 schemas

Edit `kinds/dashboard/dashboard_kind.cue` and run in the root of the repo:

```bash
make gen-cue
```

### Example of updating typed schemas (v2)

To update a v2beta1 schema, go to the file:

```bash
apps/dashboard/kinds/v2beta1/dashboard_spec.cue
```

Once you have made the changes, cd to `apps/dashboard` and run:

```bash
make generate
```

This will generate the new schema in `apps/dashboard/pkg/apis/dashboard/v2beta1/`

Also run this to update open API definitions:

```bash
./hack/update-codegen.sh
```

### Updating snapshots

In order to update OpenAPI spec snapshots run the following:

```bash
go test ./pkg/tests/apis -run TestIntegrationOpenAPIs
```

And then relevant snapshots inside `pkg/tests/apis/openapi_snapshots` will be updated.

This runs `TestIntegrationOpenAPIs` test in `pkg/tests/apis/openapi_test.go`. Note that it will fail the first time you run it. On the second run, it will generate the corresponding OpenAPI spec, which you can find in `/pkg/tests/apis/openapi_snapshots/<snapshot_name>.json`

Example update: https://github.com/grafana/grafana/pull/110842/commits/e9f5ca19cd46924bf2b927437b5ac80edcb1a2ae

### Updating api clients

Run the following:

```bash
yarn generate-apis
```
