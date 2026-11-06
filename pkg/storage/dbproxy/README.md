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

This module uses independent SemVer, starting at `v0.1.0`. Tag releases as `pkg/storage/dbproxy/vX.Y.Z` with [Grafana's release-tag workflow](../../../.github/workflows/create-release-tag.yml); imports stay the same. During v0, use patch versions for compatible fixes and minor versions for breaking Go API changes. Preserve the [V1 gRPC contract](grpc-contract.md#compatible-upgrades-and-rollback).

Release a reviewed commit already merged into `main`. From `pkg/storage/dbproxy` in a clean checkout of that commit, run `GOWORK=off go test ./...` and `GOWORK=off make proto-lint check-generated` (plus `make proto-breaking PROTO_BASE=/path/to/baseline/proto` for schema changes). Verify the tag points to that commit and Go can download the version before updating consumers. Never move a published tag.

## Generate the Go bindings

From this directory, install the pinned tools, then generate and check the bindings:

```sh
make provision-tools
make generate
make check-generated
```

Commit changes to `proto/dbproxy/v1/query.proto` and `api/dbproxy/v1` together.
Consumers use the checked-in bindings.
