# Embedded legacy permission enumeration

This package owns Grafana's compatibility client for legacy Access Control enumeration. It is not a general authorization interface: new consumers should use Check/List rather than enumerate legacy permissions.

The deprecated `LegacyGetUserPermissions` RPC is declared alongside `LegacyCheck` in [`LegacyAuthzService`](../proto/v1/legacy_authz.proto), separate from `AuthzExtentionService`. Both RPCs and their messages are defined in that file: `LegacyUserPermission` carries a single enumerated scope, unlike `LegacyCheck`'s `LegacyPermission` expression with alternative scopes. The RPC's protobuf `deprecated` option is set; it remains available only for transitional compatibility.

Do not implement permission enumeration on network/standalone AuthZ servers: their default implementation must return `Unimplemented`. Sharing the service descriptor does not share the handlers. The embedded provider in [`../rbac/legacypermissions/embedded.go`](../rbac/legacypermissions/embedded.go) constructs a private channel, authenticates the in-process transport, and validates the instance namespace independently of client preflight. Its `LegacyCheck` method remains unimplemented.

`Service` is the complete-snapshot Go interface used for injection. `LegacyClient` implements it using the generated streaming client. Its request/response types, buffering, and validation belong to Grafana, not authlib. Only existing authlib identity and service-permission helpers are reused; no new authlib version is required.

Both embedded permission RPCs share one AuthZ-owned `legacypermissions.Loader`. The existing authlib RPC still reconstructs identities from its stores/caches, maps its single skip-cache option, handles renderer grants, and deduplicates the final snapshot. It calls the loader through the existing `GetLocalUserPermissions` evaluator seam, not through Access Control or another RPC. The separate legacy RPC preserves trusted requester assertions and legacy duplicate counts. Standalone AuthZ retains its tenant-aware SQL path; this unification does not change either wire contract or production routing gates. The legacy toggle selects the legacy RPC, not every use of the loader: the existing embedded RPC now uses the shared loader whenever it is called, including when that toggle is off.

## Compatibility invariants

- Caller service identity is separate from the target identity. Role, Grafana Admin status, team IDs, contextual groups, cache key, and original requester namespace are trusted Grafana assertions, not end-user overrides.
- Request namespace identifies the instance and ordinary org. `GlobalOrg` selects org zero; `NoOrgMembership` preserves org `-1`. The flags are mutually exclusive and never bypass tenant validation. Cloud keeps its stack namespace. Self-managed sentinel evaluations without a concrete namespace use `default` only as a private transport anchor, never as the evaluation org.
- An explicitly empty original requester namespace differs from absence and preserves legacy Zanzana resolution. A nonempty value must match request namespace, except self-managed `org-0` for `GlobalOrg` or `org--1` for `NoOrgMembership` calls. Preserve those sentinels for the loader; do not make them valid transport namespaces.
- Preserve the original requester cache key so existing Access Control invalidation reaches the loader's cache entry.
- `ReloadCache` refreshes legacy caches; `SkipZanzanaCache` bypasses only Zanzana cache reads and writes. The client has no permission cache.
- Preserve duplicate action/scope pairs and empty scopes. Publish only a complete snapshot after successful EOF; discard partial results on any error. Preserve cancellation and deadlines.
- Never fall back to the old RPC or local enumeration on transport errors. The default-off `authz.legacyUserPermissions` OpenFeature toggle selects the old or embedded local path in Access Control only after the existing AuthZ delegation gate. For single-org, non-global requests with the permissions API enabled, that API remains authoritative (including empty results and failures), regardless of the legacy toggle or Enterprise license.

The generated service/messages and this client can be removed together once legacy enumeration is retired. Existing authlib Check/List, the older permission RPC, and Grafana's extension service remain unchanged.

## Transaction compatibility and remote migration

The private legacy client preserves the caller's SQL session in-process. Some existing callers, such as receiver permission copying during a contact-point rename, refresh permissions before their enclosing transaction commits. Without the shared session, enumeration reads the old committed grants and caches a snapshot missing the renamed receiver's permissions. `ReloadCache` does not make uncommitted writes visible to another SQL session.

Only the SQL session and tracing context are forwarded; unrelated caller context values and authentication are not. Transaction-bound calls wait for the handler to finish using the session before returning, including on cancellation, so the caller cannot commit, roll back, or close a session still in use. This restores local RBAC compatibility, not stronger transaction/cache isolation: refreshed permission snapshots can still be cached before commit and survive a later rollback.

Before migrating these callers to remote AuthZ enumeration:

1. Separate permission mutation from refresh. Keep copying/deleting grants inside the transaction; refresh only after the **outermost transaction commits**, using a non-transaction context. Do not refresh after rollback.
2. Refresh through the selected AuthZ client with `ReloadCache`, covering direct-user, team, and basic-role contributions. Clearing only the direct-user cache is insufficient for the receiver flow.
3. Handle post-commit refresh failures separately from mutation failures: a failed RPC cannot undo the committed rename. Define the failure/retry behavior explicitly.
4. Define read-after-write freshness. A refresh against the same primary can observe committed writes, but bypassing caches does not resolve replica lag or asynchronous synchronization.
5. Replace the embedded transaction-visibility assumption in the affected caller tests with post-commit refresh tests, and verify immediate access after rename through the remote client.

SQL session forwarding and its handler-completion tracking are embedded-only compatibility mechanisms. Do not serialize the session into gRPC metadata or expose this trusted-assertion RPC on a network server as a shortcut to remote enumeration.

## Validation

```sh
go test ./pkg/services/authz/legacyclient ./pkg/services/authz/rbac/legacypermissions
go test ./pkg/services/authz/rbac -run 'TestService_GetUserPermissions|TestIntegrationUserPermissionsRPCCompatibility' -count=1
go test ./pkg/services/authz -run '^TestIntegrationEmbeddedPermissionRPCsShareLoader$' -count=1
go test ./pkg/services/accesscontrol/acimpl -run '^TestIntegrationLegacyRoutingContracts$' -count=1 -v
```

The routing suite runs both disabled and enabled cases against real stores. Do not use `-short` for integration tests. The transport suite uses real gRPC to cover stream failures, cancellation/deadlines, assertion presence, and coexistence with the existing permission RPC. Enterprise runs the corresponding suite in `./pkg/accesscontrol/acimpl` from its own workspace.

Regenerate protobuf bindings using the existing AuthZ configuration:

```sh
buf generate pkg/services/authz/proto/v1 --template pkg/services/authz/proto/v1/buf.gen.yaml
```
