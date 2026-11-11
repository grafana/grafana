# Use the V1 write contract

Use `Exec` for a standalone write and `Transaction` for commands on one transaction stream.
The [schema](proto/dbproxy/v1/query.proto) and [generated Go API](api/dbproxy/v1) define the wire types.
These methods are published as bindings before proxy and SQL driver runtime support is available.
For read response values, column metadata, authentication, and message limits, see the [Query contract](grpc-contract.md).

## Send a standalone write

Call `Exec` with `namespace`, `query_name`, one `sql` statement, and `parameters` in positional `?` order.
Use the same stack namespace, stable query name, and `Value` encoding as `Query`.
Write calls require authorization for the service and target namespace.
`ExecResponse` returns `rows_affected` and `last_insert_id` as `int64`; zero is a valid value for either field.
For standalone and transaction `Exec`, the writer's `ClientFoundRows=true` setting makes `UPDATE` count matched rows, including unchanged matches.
An `Exec` failure returns a gRPC status with optional `QueryError` detail.
Only final gRPC `OK` confirms standalone `Exec` success.
`client.NewConn` currently installs stream authentication only; unary `Exec` needs authenticated unary transport when server support arrives.

## Run a transaction

Open one `Transaction` stream per transaction and send `begin` exactly once, as the first command.
Set `BeginRequest.namespace` and `query_name` before execution; `read_only` requests a read-only transaction.
Transactions, including read-only ones, require write-service authorization.
The proxy fixes the stack and connection at Begin and uses the database's default isolation level.
Send one command at a time, and wait for its completion before sending the next.
Send no commands after `committed` or `rolled_back`.
Missing, unknown, or out-of-order commands terminate the stream with `INVALID_ARGUMENT` and `ERROR_REASON_INVALID_REQUEST`.
While the transaction is active, clients must reject missing, unknown, or out-of-order results and abort it.

| Request command | Successful response boundary |
| --- | --- |
| `begin` | `begun` |
| `query` | `query_complete`, after `QueryResponse` schema and row batches |
| `exec` | `exec` with `rows_affected` and `last_insert_id` |
| `commit` | `committed` |
| `rollback` | `rolled_back` |

Use `Statement.sql` and `parameters` for each `query` or `exec` command.
Query responses follow the [Query value and metadata rules](grpc-contract.md#values-and-column-metadata).
`query_complete` confirms the query finished successfully; receiving some rows does not rule out a later error.
If you close rows early, drain to `query_complete` before continuing.
A new error discovered during `Rows.Close` aborts the transaction.
Errors already reported by `Rows.Next` or `Exec` remain recoverable when the database permits.
The `committed` acknowledgment confirms success even if stream teardown then fails.
Clean stream closure without `committed` or `rolled_back` does not confirm a transaction outcome.
Closing or cancelling the stream before `commit` requests rollback; cancellation does not prove rollback completed.

Set an optional positive `TransactionRequest.timeout` for a command; an absent timeout uses the remaining stream or server budget.
The SQL driver derives this from the operation context deadline, since messages on an existing gRPC stream do not carry separate deadlines.
Zero, negative, or invalid durations are rejected.
The effective timeout cannot exceed the remaining stream lifetime.
Command timeouts never reset the transaction's total lifetime.
The server also caps lifetime by its configured maximum, idle-between-commands timeout, and token expiry.
Timeout or cancellation aborts the transaction; a possibly sent `commit` still has an unknown outcome without its acknowledgment.

## Handle errors and uncertain outcomes

A recoverable SQL error returns `TransactionResponse.error` with a safe message and `DatabaseError` code and SQLSTATE.
The `error` frame completes the failed command without `query_complete`.
Treat it as `FAILED_PRECONDITION` with `ERROR_REASON_SQL_ERROR`; the stream remains usable.
Whole-transaction rollback, such as a deadlock, or uncertain transaction state is fatal; execute no later SQL.
Only errors that leave the transaction usable return in-band `error` frames.
Fatal errors close the stream with a gRPC status and may include `QueryError` detail.
Treat lost replies after a possibly dispatched standalone `Exec` or transaction `commit` as an unknown outcome.
The proxy reports `ERROR_REASON_OUTCOME_UNKNOWN` with gRPC `UNKNOWN` when it can.
Transport failure or cancellation may omit that detail; track pending standalone writes and commits yourself.
Do not automatically retry a possibly dispatched write or commit, or convert that failure to `driver.ErrBadConn`.
A definite pre-execution rejection cannot have committed a write.

## Keep SQL within the contract

Use one statement per command, unqualified table names, and positional `?` parameters.
Issue transaction boundaries through protocol commands; SQL `BEGIN`, `COMMIT`, and full `ROLLBACK` are unsupported.
`SAVEPOINT`, `ROLLBACK TO SAVEPOINT`, and `RELEASE SAVEPOINT` are supported within a transaction.
DDL, session changes, multiple statements, and cross-schema references are unsupported.

Next, use the [Query contract](grpc-contract.md) for authentication and shared wire values.
