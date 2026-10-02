# Re-embedding version approval

Increasing an existing resource's `embed.<resource>.reembedVersion` can trigger a
full re-embedding backfill wherever that declaration is deployed and the resource
is enrolled. The cost includes all affected instances and namespaces, not just a
single instance used for testing.

The PR check compares generated `manifest.go` and `*_manifest.go` files between the
PR's merge base and head. It reads the resource-level `Embed` map in
`app.ManifestData` and requires the exact `re-embed-approved` PR label when an
existing `ReembedVersion` increases. New declarations, field-only changes,
declaration removal, and custom Go builder version constants are outside this
check's scope. Test fixtures under `testdata` are excluded. Commit regenerated
manifests with declaration changes.

Before adding the label, review the reason for the bump, affected deployments,
and expected provider cost. Use
`grafana_vector_storage_embeddings_stored{resource="folders"}` as a starting point
for sizing across the affected deployments and models. Its `resource` label is
the vector partition key: the resource name lowercased with non-alphanumeric
characters replaced by underscores. It counts embedding rows, not resources;
chunked resources can have many rows. New extraction rules can also change the
number or size of those rows, so this is an estimate rather than a token or cost
measurement. CI does not query metrics or require production credentials.

Adding or removing `re-embed-approved` reruns the check. A maintainer must create
the label if it does not exist. The workflow is included in the repository's
generated policy-bot rules; run `make .policy.yml` after changing its triggers.

To run locally from the repository root, use a GitHub pull-request event JSON file
containing `pull_request.labels`:

```sh
GOWORK=off GO111MODULE=off go test ./scripts/ci/reembed-version-approval
GOWORK=off GO111MODULE=off go run ./scripts/ci/reembed-version-approval \
  --base origin/main --head HEAD --event /tmp/pull-request-event.json
```

The checker uses Git and the Go standard library; it does not load Grafana's Go
workspace or download its dependencies.
