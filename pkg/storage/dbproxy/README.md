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

After merging a dbproxy change, check out the merged Grafana commit. From `pkg/storage/dbproxy`, run `GOWORK=off go test ./...` and `GOWORK=off make proto-lint check-generated`. For schema changes, also run `make proto-breaking PROTO_BASE=/path/to/baseline/proto`.

Then create the next version with [Grafana's release-tag workflow](../../../.github/workflows/create-release-tag.yml):

```sh
VERSION=v0.1.1 # choose the next version
gh workflow run create-release-tag.yml --repo grafana/grafana --ref main \
  -f tag="pkg/storage/dbproxy/$VERSION" -f commit="$(git rev-parse HEAD)"
```

Wait for the workflow to succeed, then update each consumer from its checkout with `go get "github.com/grafana/grafana/pkg/storage/dbproxy@$VERSION"`. Imports stay the same. During v0, use patch versions for compatible fixes and minor versions for breaking Go API changes. Preserve the [V1 gRPC contract](grpc-contract.md#compatible-upgrades-and-rollback). Never move a published tag.

## Generate the Go bindings

From this directory, install the pinned tools, then generate and check the bindings:

```sh
make provision-tools
make generate
make check-generated
```

Commit changes to `proto/dbproxy/v1/query.proto` and `api/dbproxy/v1` together.
Consumers use the checked-in bindings.
