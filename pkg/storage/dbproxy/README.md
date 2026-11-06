# Single-tenant database proxy Go module

Use this module to call the V1 single-tenant database proxy from Go.
It contains the [gRPC API](grpc-contract.md), an optional authenticated [connection helper](client), and a [Go SQL driver](sql-driver.md).

## Start with the API

Import `github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1` for `QueryRequest`, `QueryResponse`, and `NewDatabaseProxyServiceClient`.
The generated package also provides `DatabaseProxyServiceServer` for server implementations.
The server exposes `dbproxy.v1.DatabaseProxyService/Query`.
The current server authenticates requests but returns `UNIMPLEMENTED` for authorized queries.

For `database/sql`, follow the [SQL driver guide](sql-driver.md).
For wire values, stream completion, errors, and SQL limits, read the [V1 contract](grpc-contract.md).

## Release the module

The API, authenticated client helper, and SQL driver share one module version.
Select releases intentionally after reviewing changes to `pkg/storage/dbproxy`.
Use `v0.1.0` for the first release, then increment the patch for compatible fixes.
During v0, use a new minor version for a potentially breaking Go API change and provide migration notes.
Preserve the [V1 gRPC compatibility rules](grpc-contract.md#compatible-upgrades-and-rollback) across module versions.
A v1 release requires a deliberate stability decision; a v2 or later module requires a separate major-version import path.
Grafana's product version does not set this module's version.

Tag a release in the Grafana repository as `pkg/storage/dbproxy/v0.1.0`.
Go consumers request `github.com/grafana/grafana/pkg/storage/dbproxy@v0.1.0`.
The directory prefix belongs to the Git tag, not the module version or import path.

### Check the release commit

From the Grafana repository, fetch `main` and inspect the remote module tags:

```sh
git fetch origin main:refs/remotes/origin/main
git ls-remote --tags origin 'refs/tags/pkg/storage/dbproxy/*'
```

Choose a full commit SHA already merged into `origin/main`.
Replace the placeholders below with the selected full SHA and the commit used by the current consumer.
Confirm the ancestor check succeeds, then compare the module trees:

```sh
git merge-base --is-ancestor <approved-full-merged-SHA> origin/main
git diff <current-consumer-commit> <approved-full-merged-SHA> -- pkg/storage/dbproxy
```

Review API and generated-binding changes, especially for the first release.
Check the [V1 compatibility rules](grpc-contract.md#compatible-upgrades-and-rollback) before releasing schema changes.
Run the release checks from a clean, detached worktree at the approved commit, not from the current checkout.
From the Grafana repository, replace the placeholder with the same full SHA used above:

```sh
release_sha='<approved-full-merged-SHA>'
release_worktree=$(mktemp -d)
git worktree add --detach "$release_worktree" "$release_sha"
test "$(git -C "$release_worktree" rev-parse HEAD)" = "$release_sha"
test -z "$(git -C "$release_worktree" status --porcelain)"
(cd "$release_worktree/pkg/storage/dbproxy" && GOWORK=off go test ./... && GOWORK=off make proto-lint check-generated)
```

For a schema change, also run the compatibility check against the selected baseline from that worktree:

```sh
(cd "$release_worktree/pkg/storage/dbproxy" && GOWORK=off make proto-breaking PROTO_BASE=/path/to/baseline/proto)
```

Stop if any check fails. Remove the temporary worktree after the checks, including when they fail:

```sh
git worktree remove "$release_worktree"
```

Confirm the intended version is unused and obtain release approval before creating its tag.

### Create and verify the tag

After the documentation is merged and the release commit is approved, run Grafana's existing `create-release-tag.yml` workflow:

```sh
gh workflow run create-release-tag.yml --repo grafana/grafana --ref main \
  -f tag=pkg/storage/dbproxy/v0.1.0 \
  -f commit=<approved-full-merged-SHA> \
  -f message='dbproxy v0.1.0'
```

Replace the commit placeholder with the approved full SHA.
The dispatch command only queues the workflow.
Inspect its completed run in **GitHub Actions**, then verify the remote tag:

```sh
git ls-remote --tags origin \
  'refs/tags/pkg/storage/dbproxy/v0.1.0' \
  'refs/tags/pkg/storage/dbproxy/v0.1.0^{}'
```

The output must have an annotated tag object line and a peeled `^{}` line whose SHA matches the approved commit.
From a disposable directory outside Grafana's workspace, verify public module resolution:

```sh
GOWORK=off go list -m -versions github.com/grafana/grafana/pkg/storage/dbproxy
GOWORK=off go mod download -json github.com/grafana/grafana/pkg/storage/dbproxy@v0.1.0
```

The version list must contain `v0.1.0`.
The download result must report the exact module path and version, include checksums, and contain no `Error`.
Only then update consumers to `github.com/grafana/grafana/pkg/storage/dbproxy@v0.1.0` and review their dependency changes.

### Recover from a failed release

If the workflow fails, inspect its run before retrying.
A rerun with the same annotated tag and commit succeeds without moving the tag.
A tag on a different commit, a lightweight tag, or a tag lookup failure stops the workflow; investigate the conflict or permission error.
If the tag exists but Go cannot fetch the release yet, keep consumers on their current version and retry the public resolution checks.
Never move or delete a published tag to repair a release.
If a published release is faulty, revert consumers to their previous version and publish a reviewed patch release.

## Generate the Go bindings

From this directory, install the pinned tools, then generate and check the bindings:

```sh
make provision-tools
make generate
make check-generated
```

Commit changes to `proto/dbproxy/v1/query.proto` and `api/dbproxy/v1` together.
Consumers use the checked-in bindings.
