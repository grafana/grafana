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

## Generate the Go bindings

From this directory, install the pinned tools, then generate and check the bindings:

```sh
make provision-tools
make generate
make check-generated
```

Commit changes to `proto/dbproxy/v1/query.proto` and `api/dbproxy/v1` together.
Consumers use the checked-in bindings.
