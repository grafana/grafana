# Use the Go SQL driver

Use the `client` and `sqldriver` packages to run attributed, parameterized SQL through `database/sql`.
Import them from `github.com/grafana/grafana/pkg/storage/dbproxy/client` and `github.com/grafana/grafana/pkg/storage/dbproxy/sqldriver`.
Import the generated API as `dbproxyv1` from `github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1`.

## Open a shared connection and SQL pool

Supply the proxy target, gRPC transport credentials matching the endpoint, and an `authn.TokenExchanger` to `client.NewConn`.
The authlib unary and stream interceptors exchange a service token for audience `single-tenant-db-proxy` and namespace `*`.
Each query still names one concrete stack.
CAP token authentication applies with either TLS or plaintext transport.

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

Set the stack namespace and stable query name on each `QueryContext` or `ExecContext` call.
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
Closing standalone query rows early cancels the stream; it does not establish that the full result succeeded.
For a standalone query, `QueryRowContext` closes its rows after `Scan` reads one row, so it cannot confirm success of a later stream tail.
For a standalone query, drain `Rows` and check `Rows.Err()` when you need complete-result success.
Inside a transaction, closing rows early drains the remaining result to command completion with bounded memory.
A new error found during `Rows.Close` aborts the transaction, so check the close error when you stop reading early.

Preparation makes no RPC and does not retain the preparation context as query identity.
Pass `WithQuery` on the context used for each prepared statement execution.
Adapters can attach a name with `WithQueryName` and read it with `QueryName` before adding the current stack with `WithQuery`.

## Write and commit a transaction

Use `ExecContext` for a standalone write or within a transaction.
It returns `RowsAffected` and `LastInsertId`; MySQL reports matched rows for `UPDATE`, including unchanged matches.
Prepared statements also support `ExecContext`.
Provide `WithQuery` on each execution context, even when you prepared the statement with another context.

Use `BeginTx` with a concrete stack namespace and the default isolation level.
You can request `ReadOnly` through `sql.TxOptions`.
The Begin context owns the transaction lifetime, and each statement context supplies its own query name and deadline.
All statements in a transaction must use the same namespace.

For example, run one write and commit it:

```go
beginCtx := sqldriver.WithQuery(ctx, "stacks-123", "")
tx, err := pool.BeginTx(beginCtx, nil)
if err != nil {
    return err
}
defer tx.Rollback()

writeCtx := sqldriver.WithQuery(beginCtx, "stacks-123", "example.item_update")
_, err = tx.ExecContext(writeCtx,
    "UPDATE items SET value = ? WHERE id = ?", "new value", int64(1))
if err != nil {
    return err
}
return tx.Commit()
```

A transaction uses one stream and runs commands in order.
Consume or close query rows before sending the next transaction command.
It supports `QueryContext`, `ExecContext`, and `SAVEPOINT`, `ROLLBACK TO SAVEPOINT`, and `RELEASE SAVEPOINT` SQL.
A recoverable SQL error reported by `Rows.Next` or `ExecContext` can leave the transaction usable.
Cancellation, a fatal stream error, or an error first found during `Rows.Close` aborts it.

If `errors.Is(err, sqldriver.ErrOutcomeUnknown)` after a standalone write or `Commit`, the write may have taken effect.
Don't retry it automatically; check the resulting state or reconcile it through your application's workflow.
A confirmed commit remains successful even if the stream then fails to close cleanly.

## Know the supported operations

The driver supports V1 reads, writes, transactions, and positional parameters through `database/sql`.
`Ping`, contextless execution, and custom transaction isolation levels remain unsupported.
Older proxy servers return `UNIMPLEMENTED` for `Exec` and `Transaction`; the driver doesn't fall back to another method.
Deploy supporting server code before enabling writes or transactions.
The [V1 gRPC contract](grpc-contract.md) describes supported SQL and result types.
The driver does not parse SQL or enforce those server-side restrictions.
It preserves empty `[]byte` values separately from SQL `NULL` and returns unsigned integers as exact decimal bytes.
The current client uses gRPC's standard 4 MiB receive limit; align the server's message limit with it.
The streaming batch size is a target for each message, not a total row limit.

Before connecting a live consumer, verify its queries and write authorization against the proxy.

Next, read the [V1 gRPC contract](grpc-contract.md) for read stream completion and the [write contract](write-contract.md) for transaction results and errors.
