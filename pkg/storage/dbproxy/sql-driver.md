# Use the Go SQL driver

Use the `client` and `sqldriver` packages to run attributed, parameterized reads through `database/sql`.
Import them from `github.com/grafana/grafana/pkg/storage/dbproxy/client` and `github.com/grafana/grafana/pkg/storage/dbproxy/sqldriver`.
Import the generated API as `dbproxyv1` from `github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1`.

## Open a shared connection and SQL pool

Supply the proxy target, service-authenticated gRPC transport credentials, and an `authn.TokenExchanger` to `client.NewConn`.
The authlib stream interceptor exchanges a service token for audience `single-tenant-db-proxy` and namespace `*`.
Each query still names one concrete stack.
Use insecure transport only for an explicit local fixture.

```go
conn, err := client.NewConn(target, transportCredentials, tokenExchanger)
if err != nil {
    return err
}
defer conn.Close()

proxyClient := dbproxyv1.NewDatabaseProxyServiceClient(conn)
connector, err := sqldriver.New(proxyClient).OpenConnector("")
if err != nil {
    return err
}
pool := sql.OpenDB(connector)
defer pool.Close()
```

Create one shared connection and client for the service, then reuse them across SQL pools.
Close every pool before closing the shared gRPC connection.
Closing rows, statements, or individual SQL connections leaves the shared connection open.
Construction does not contact the endpoint; remote failures surface on queries.

You can also register one immutable driver at process startup with `sql.Register` and open pools with `sql.Open`.
The DSN does not configure transport; `client.NewConn` already owns the target and credentials.

## Add query identity to the execution context

Set the stack namespace and stable query name on each `QueryContext` call.
The namespace uses `stacks-<positive integer>`; query names match `[a-z][a-z0-9_.-]{0,127}`.
Missing or invalid identity fails locally.

```go
queryCtx := sqldriver.WithQuery(ctx, "stacks-123", "usageinsights.dashboard_stats.list")
rows, err := pool.QueryContext(queryCtx,
    "SELECT dashboard_uid FROM dashboard_usage_sums WHERE org_id = ?", int64(1))
if err != nil {
    return err
}
defer rows.Close()

for rows.Next() {
    var dashboardUID string
    if err := rows.Scan(&dashboardUID); err != nil {
        return err
    }
    // Use dashboardUID.
}
return rows.Err()
```

Check `Rows.Err()` after iteration because a stream can fail after some rows arrive.
Treat those rows as an incomplete result when it reports an error.
Closing rows early cancels the stream; it does not establish that the full result succeeded.
`QueryRowContext` closes its rows after `Scan` reads one row, so it cannot confirm success of a later stream tail.
If you need complete-result success, drain `Rows` and check `Rows.Err()`.

Preparation makes no RPC and does not retain the preparation context as query identity.
Pass `WithQuery` on the context used for each prepared statement execution.
Adapters can attach a name with `WithQueryName` and read it with `QueryName` before adding the current stack with `WithQuery`.

## Know the supported operations

The driver exposes V1 read queries and positional parameters through `database/sql`.
`Exec`, `Ping`, and transactions return `sqldriver.ErrUnsupported`.
Contextless queries fail because they have no stack and query name.
The [V1 gRPC contract](grpc-contract.md) describes supported SQL and result types.
The driver does not parse SQL or enforce those server-side restrictions.
It preserves empty `[]byte` values separately from SQL `NULL` and returns unsigned integers as exact decimal bytes.
The current client uses gRPC's standard 4 MiB receive limit; align the server's message limit with it.
The streaming batch size is a target for each message, not a total row limit.

The current proxy endpoint returns `UNIMPLEMENTED` for Query until query execution is available.
Before connecting a live consumer, verify its queries against a proxy with execution and streaming enabled.

Next, read the [V1 gRPC contract](grpc-contract.md) for stream completion and error details.
