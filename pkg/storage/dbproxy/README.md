# Single-tenant database proxy Go module

Use this module's V1 schema and generated Go gRPC bindings for the single-tenant database proxy.
Read the [gRPC contract](grpc-contract.md) before sending queries or implementing a server.

## Start with the API

Import `github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1` for `QueryRequest`, `QueryResponse`, and `NewDatabaseProxyServiceClient`.
The generated package also provides `DatabaseProxyServiceServer` for server implementations.
The server exposes `dbproxy.v1.DatabaseProxyService/Query`.
The current server authenticates requests but returns `UNIMPLEMENTED` for authorized queries.

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
