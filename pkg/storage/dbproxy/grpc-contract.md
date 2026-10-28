# V1 gRPC contract

Use this V1 contract to send attributed, read-only SQL queries to the single-tenant database proxy.
The [schema](proto/dbproxy/v1/query.proto) and [generated Go API](api/dbproxy/v1) live in this module.
The current server authenticates and authorizes `Query` calls, then returns `UNIMPLEMENTED` with `QUERY_UNSUPPORTED` before sending a response.

## Request and query identity

`dbproxy.v1.DatabaseProxyService/Query` takes one request and returns a stream.

| Field | Contract |
| --- | --- |
| `namespace` | Required target stack namespace, for example `stacks-123`. Use the same value for authorization and Settings service lookups. |
| `query_name` | Required stable name chosen by the calling service, for example `usageinsights.dashboard_stats.list`. Use `[a-z][a-z0-9_.-]{0,127}`; never include stack IDs, parameters, or other per-request values. |
| `sql` | Required, nonempty single read statement, with positional `?` placeholders and unqualified database table names. Table aliases and `table.column` references are supported. |
| `parameters` | Values in placeholder order. An empty list means no parameters. Each value must select one known `kind`, including explicit SQL NULL. |

The namespace must identify a concrete stack with a positive stack ID; wildcard
token authorization still requires a specific target namespace in each request.

`query_name` attributes a logical query to the authenticated service. The server
executes the supplied SQL. Filtering and pagination may change SQL text without
changing the logical name. A trace identifies an individual call.

Clients bind parameter values; neither the client nor proxy substitutes them into
SQL text. Named parameters and identifier parameters are unsupported. MySQL
handles placeholder validation; mismatched bindings are reported as invalid
requests when detected before execution, otherwise as SQL errors.

## Authentication, metadata, and deadlines

| Metadata | Contract |
| --- | --- |
| `x-access-token` | Exactly one raw signed access token from the CAP exchange, intended for the proxy. No `Bearer ` prefix. This matches authlib's gRPC token provider and client interceptor. |
| `traceparent`, `tracestate` | Optional tracing context, supplied and consumed by tracing instrumentation. Never a source of identity or authorization. |

Use authenticated transport according to the deployment's service transport
configuration. Tokens must not be sent over an untrusted plaintext connection.
The authentication implementation verifies the token with configured trusted
signing keys and validates its audience, signature, expiry, service allowlist,
and namespace authorization against the requested namespace. It derives caller
identity from the signed `serviceIdentity` claim.
The listener requires an explicit expiry and accepts authlib's standard one-minute
clock tolerance. It rejects duplicate `x-access-token` metadata, an empty or
prefixed token, a missing top-level service identity, and a request namespace
that does not name a positive stack. Authentication failures are
`UNAUTHENTICATED`; an authenticated but disallowed service or namespace is
`PERMISSION_DENIED`. Error messages are fixed and do not expose token or signing-key
details.
Tokens target audience `single-tenant-db-proxy`; deployment configures the trusted
signing-key endpoint. This RPC does not accept a raw CAP credential or require an
end-user ID token. SQL, parameters, and namespace belong in the request.

The caller sets a context deadline, which the gRPC library propagates to the proxy.
The proxy applies the earlier of that deadline and its configured maximum request
duration, including routing, pool wait, execution, and streaming. With no caller
deadline, the proxy's maximum still applies. Cancellation or `Rows.Close` stops
the RPC and releases its database resources; it does not establish success.

## Stream sequence and completion

```text
QueryRequest
  -> QueryResponse { columns } (exactly once, at least one column)
  -> QueryResponse { rows, warnings } (zero or more, either or both populated)
  -> final gRPC status
```

- Authentication, validation, routing, and execution errors can end the RPC
  before a schema is available. A successful empty result still sends its schema.
- The first response contains only `columns`, with at least one column. Every
  later response contains rows, warnings, or both, and no columns. Empty response
  messages are invalid. Each gRPC message supplies the batch boundary.
- Schema columns follow SQL projection order and preserve names, aliases, and
  duplicates. The schema does not change during a call. `VALUE_TYPE_UNSPECIFIED`
  is invalid; `VALUE_TYPE_NULL` is for an expression known to produce only NULL.
- Each row has exactly one value per column, in order. A non-NULL value must match
  its column's `value_type`. `nullable=true` allows explicit NULL values;
  `nullable=false` requires non-NULL values. When `nullable` is absent, nullability
  is unknown and the client accepts either. A `VALUE_TYPE_NULL` column contains
  only NULL values and must not declare `nullable=false`.
- Responses contain complete rows and preserve database order.
  SQL must use `ORDER BY` when it needs deterministic ordering. Batch boundaries
  have no semantic meaning and may change between calls or server versions.
- The configured streaming batch size is a target. A single complete row may
  exceed that target; every encoded response must fit the effective gRPC message
  limit. A row that cannot fit fails with `RESOURCE_EXHAUSTED`. Client and server
  message limits must be configured consistently. No total result row/byte limit
  is introduced by this contract.
- Clients must accept warnings in any mix with rows after the initial schema,
  including together in one message and across multiple messages. Servers may
  collect and send warnings at the end using the same reserved database
  connection. Warnings are informational and may be ignored by the SQL driver.
  The MVP does not promise warning collection; an absence of warnings means
  availability is unknown. Warning codes are strings, with MySQL codes encoded
  as decimal strings. Messages follow the error sanitization rules below.
- Only final gRPC `OK` means success. The generated Go client's `Recv` returns
  `io.EOF` for successful completion; it returns an error for failed completion.
  There is no separate success/error response message.
- A failure after batches have arrived means the result is incomplete. The SQL
  driver must return it from row iteration so `Rows.Err()` reports it. Callers
  that buffer a result must discard that result on failure. Callers that process
  rows incrementally must account for partial processing. Closing rows early is
  cancellation, not evidence of successful completion.

The Go SQL driver validates response order, row widths, and value kinds. Empty
responses, rows or warnings in the first response, repeated columns, unknown
value types, or `OK` without a schema are protocol errors. The generated gRPC
bindings alone do not perform these semantic checks.

## Values and column metadata

`Value` uses a protobuf `oneof` to preserve NULL, false, zero, and empty values as
different values. Integers do not pass through floating point or JSON.

| Kind | Wire representation | Go SQL driver result |
| --- | --- | --- |
| NULL | Explicit `null_value` | `nil` |
| Signed integer | `sint64 int64_value` | `int64` |
| Unsigned integer | `uint64 uint64_value` | Exact base-10 `[]byte` (Go's `driver.Value` does not include `uint64`) |
| Floating point | `double float64_value` | `float64` |
| Boolean | `bool bool_value` | `bool` |
| Text | UTF-8 `string_value` | `string` |
| Bytes | Unmodified `bytes_value` | `[]byte`, including empty bytes distinct from NULL |
| Timestamp | `google.protobuf.Timestamp` | UTC `time.Time`, preserving fractional seconds |
| Decimal | `bytes_value`, exact base-10 text | `[]byte`, preserving precision and scale |

Timestamp values must be valid protobuf timestamps. Invalid parameter encodings
are `INVALID_ARGUMENT`. MySQL parameter binding and column precision govern the
values MySQL accepts. When binding a present but empty `bytes_value`, use a
non-nil empty `[]byte`: the MySQL driver treats a nil byte slice as SQL NULL.

The schema supplies MySQL's database type name separately from the wire kind.
For example, MySQL text columns may use `BYTES` because the Go MySQL driver
returns `[]byte`; this also preserves non-UTF-8 data. `DECIMAL` also uses `BYTES`,
preserving its exact text without a conversion through floating point; its type,
precision, and scale remain in column metadata. For a given column, the server
chooses its wire kind from metadata before sending the schema and uses it for
all non-NULL rows. Do not infer a column's kind from its first value: results can
be empty or NULL.

`nullable` and `length` are optional; absence means the database driver could not
report that property. A present `false` or `0` is a known value. `decimal_size`
contains precision and scale only when both are known. Length and decimal-size
values follow Go's `sql.ColumnType` methods. Never fabricate zero values for
unknown metadata. A NULL-only expression may have an empty database type name.

When query execution is available, database connections use UTC interpretation (`parseTime=true`,
`loc=UTC`, and a UTC MySQL session time zone). DATETIME wall-clock values are
interpreted as UTC; TIMESTAMP values are read in UTC. The driver returns those
instants as UTC `time.Time`. A MySQL all-zero date maps to Go's zero time,
represented by the valid protobuf timestamp `0001-01-01T00:00:00Z`, not NULL or the
Unix epoch. The provider adapter must retain the existing xorm time-zone settings.
The MVP retains the native MySQL driver's date-decoding behavior: that driver can
normalize partial-zero or invalid date components before the proxy sees them.
The wire preserves the resulting `time.Time`, not the original malformed SQL
text. Detecting those source values would require separate raw-date validation.
SQL TIME values remain bytes, preserving durations outside 24 hours.

## Errors and retries

The final gRPC status is authoritative. Application failures attach one
`QueryError` detail using `status.WithDetails`, with the following mapping:

| Failure | gRPC code | `ErrorReason` suffix |
| --- | --- | --- |
| Malformed request or value | `INVALID_ARGUMENT` | `INVALID_REQUEST` |
| Missing, invalid, expired, or wrong-audience token | `UNAUTHENTICATED` | `UNAUTHENTICATED` |
| Service not allowed or stack outside token authorization | `PERMISSION_DENIED` | `PERMISSION_DENIED` |
| Settings service cannot resolve the stack | `NOT_FOUND` | `STACK_NOT_FOUND` |
| Resolved stack is neither active nor paused | `FAILED_PRECONDITION` | `STACK_STATE_UNSUPPORTED` |
| Recognized unsupported SQL operation or result representation | `UNIMPLEMENTED` | `QUERY_UNSUPPORTED` |
| Settings service/routing dependency unavailable, or resolved server configuration missing | `UNAVAILABLE` | `ROUTING_UNAVAILABLE` |
| Database connection, availability, or unresolved stale-route failure | `UNAVAILABLE` | `DATABASE_UNAVAILABLE` |
| Other MySQL query error, including syntax, missing table, or invalid column | `FAILED_PRECONDITION` | `SQL_ERROR` |
| Configured resource/message limit reached | `RESOURCE_EXHAUSTED` | `LIMIT_EXCEEDED` |
| Caller deadline or proxy request timeout | `DEADLINE_EXCEEDED` | `DEADLINE_EXCEEDED` |
| Caller cancelled | `CANCELLED` | `CANCELLED` |
| Unexpected proxy implementation failure | `INTERNAL` | `INTERNAL` |

For database errors, populate `QueryError.database_error` with a `DatabaseError`.
Its `code` is a string; encode MySQL error codes as decimal strings and include
`sql_state` when available. Messages are human-readable and sanitized: do not
expose credentials, raw SQL, parameter values, backend addresses, or physical
database names. Clients branch on codes/details, never message text.
Authentication and authorization precede stack resolution, including for requests
that would otherwise be missing.

Transport/library failures can omit `QueryError`, and clients must handle every
gRPC code, missing details, and unknown reason values. Context cancellation may
arrive without the server's richer detail. SQL errors that occur after rows are
sent retain the same code and detail as errors before rows; a successful schema
or batch does not commit the query's outcome.

The client and SQL driver do not replay queries.
Reads can be nondeterministic, and replay after delivering rows can duplicate processing.
Callers may start a new request with a new deadline when appropriate; there is no stream resume token.

## Supported SQL and session boundaries

When query execution is available, V1 permits one read `SELECT`.
It permits joins, subqueries, supported CTEs, aggregation, ordering, and SQL pagination.
Use unqualified table names; the target stack determines database selection.

Unsupported in V1:

- Writes, DDL, locking reads (`FOR UPDATE`, `FOR SHARE`), and SELECT forms or
  functions with side effects, such as `INTO OUTFILE` or advisory locks.
- Multiple statements or result sets, stored procedure calls, explicit
  transactions (including read-only ones), and session-based cursors.
- Caller-issued `USE`, `SET`, session variables, temporary tables, or any query
  depending on state established by an earlier call.
- Cross-database references, including `hg_<slug>.table`, and access to MySQL
  system schemas. Table qualification such as `alias.column` remains valid.
- SQL `PREPARE`/`EXECUTE` and client-visible server statement handles.
  The Go SQL driver's local `PrepareContext` stores SQL and sends a new Query for each execution.

The contract defines permitted use; it does not promise a complete SQL parser.
Callers must use only the supported operations.

## Packages and releases

The V1 API is published in the module `github.com/grafana/grafana/pkg/storage/dbproxy`.
Consumers pin a public module version independently of the proxy server image.

## Compatible upgrades and rollback

- Preserve V1 method names, field numbers, existing types, enum numbers, and
  meanings. Reserve removed field/enum names and numbers; never reuse them.
- Additive fields must be optional and preserve old behavior when absent. New
  request fields must be safe for old servers to ignore. An older server must
  never silently drop a new field that is required for correct execution.
- Unknown informational fields can be ignored. New value kinds and enum values
  used in rows are **not** safe to send to old V1 clients simply because protobuf
  can decode the message. Keep the V1 repertoire fixed; use a new RPC/version for
  semantics requiring those extensions.
- Absent optional metadata means unknown; no parameters means none; no warnings
  means warning availability is unknown. Missing `kind`, missing schema,
  and unspecified column types never default to valid data or success.
- Deploy additive server changes first, then clients. Keep the old behavior
  supported so either side can roll back independently. A new V2 method must
  coexist with V1 until its consumers have migrated and the rollback window has
  passed. Do not depend on a coordinated proxy/enterprise rollout.
- Buf's `FILE` compatibility rules compare a changed schema with a selected base revision.
  Review semantics, defaults, and mixed-version behavior as well.

The wire-evolution rules follow the
[protobuf compatibility guidance](https://protobuf.dev/programming-guides/proto3/#updating),
and error codes follow the [gRPC status definitions](https://grpc.io/docs/guides/status-codes/).

## Generate and check bindings

From `pkg/storage/dbproxy`, provision the pinned tools before generating bindings or checking the schema:

```sh
make provision-tools
make generate
make proto-lint check-generated
make proto-breaking PROTO_BASE=/path/to/baseline/proto
```

`proto-breaking` compares with an existing baseline schema directory.
Skip that comparison until a baseline exists for this module.
Commit changes to the schema and generated API together.

Next, import the [generated Go API](api/dbproxy/v1) to build a client or server for this contract.
