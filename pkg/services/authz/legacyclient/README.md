# Embedded legacy permission enumeration

This package owns Grafana's compatibility client for legacy Access Control enumeration. It is not a general authorization interface: new consumers should use Check/List rather than enumerate legacy permissions.

The wire contract is the separate `LegacyAuthzService` in [`../proto/v1/legacy_permissions.proto`](../proto/v1/legacy_permissions.proto). Do not add it to `AuthzExtentionService` or register it on network/standalone AuthZ servers. The embedded provider in [`../rbac/legacypermissions/embedded.go`](../rbac/legacypermissions/embedded.go) constructs a private channel, authenticates the in-process transport, and validates the instance namespace independently of client preflight.

`Service` is the complete-snapshot Go interface used for injection. `LegacyClient` implements it using the generated streaming client. Its request/response types, buffering, and validation belong to Grafana, not authlib. Only existing authlib identity and service-permission helpers are reused; no new authlib version is required.

Both embedded permission RPCs share one AuthZ-owned `legacypermissions.Loader`. The existing authlib RPC still reconstructs identities from its stores/caches, maps its single skip-cache option, handles renderer grants, and deduplicates the final snapshot. It calls the loader through the existing `GetLocalUserPermissions` evaluator seam, not through Access Control or another RPC. The separate legacy RPC preserves trusted requester assertions and legacy duplicate counts. Standalone AuthZ retains its tenant-aware SQL path; this unification does not change either wire contract or production routing gates. The legacy toggle selects the legacy RPC, not every use of the loader: the existing embedded RPC now uses the shared loader whenever it is called, including when that toggle is off.

## Compatibility invariants

- Caller service identity is separate from the target identity. Role, Grafana Admin status, team IDs, contextual groups, cache key, and original requester namespace are trusted Grafana assertions, not end-user overrides.
- Request namespace identifies the instance and ordinary org. `GlobalOrg` selects org zero within that instance, never across tenants.
- An explicitly empty original requester namespace differs from absence and preserves legacy Zanzana resolution. A nonempty value must match request namespace; the embedded server rejects conflicts.
- Preserve the original requester cache key so existing Access Control invalidation reaches the loader's cache entry.
- `ReloadCache` refreshes legacy caches; `SkipZanzanaCache` bypasses only Zanzana cache reads and writes. The client has no permission cache.
- Preserve duplicate action/scope pairs and empty scopes. Publish only a complete snapshot after successful EOF; discard partial results on any error. Preserve cancellation and deadlines.
- Never fall back to the old RPC or local enumeration on transport errors. The default-off `authz.legacyUserPermissions` OpenFeature toggle selects the old or embedded path in Access Control.

The generated service/messages and this client can be removed together once legacy enumeration is retired. Existing authlib Check/List, the older permission RPC, and Grafana's extension service remain unchanged.

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
