# User permission enumeration

`GetUserPermissions` returns the existing Grafana action/scope response. It reads
relationships through `storage.OpenFGADatastore`, translates the supported schema
into per-action results, applies shared legacy scope formatting, and streams the
complete result. This path does not run OpenFGA queries or create an evaluator.
The datastore can be remote over gRPC and does not require SQL.

## Translation

`resolveUserPermissionContributions` follows the subject's stored team memberships
and role assignments. Team administration implies membership. Request-supplied
teams add membership only for that request. User, team-member and role-assignee
principals are each read with a user-only datastore filter.

`translatePermissionGrants` reuses the existing action/resource mappings. It
expands view/edit/admin grants, team membership and administration, and the
schema's local subresource relations. Group and subresource conditions restrict
which actions receive the grant. Wildcard scopes use group-resource grants.
Folder scopes identify explicit grant locations, including explicit child grants.
Folder parent edges are not traversed to enumerate inherited descendants.

`getStoreInfo` selects or creates the model matching the bundled schema. Permission
enumeration does not read or compare the model again. Unsupported tuple
subjects, relations, object forms or condition bindings fail the whole request
before any response is sent. In particular, stored conditions may bind only
`group_resource` or `subresources`, not the corresponding request parameters.
Tests compare supported grant forms with OpenFGA using a graph without folder
parent edges. Schema changes require updating and reviewing the translator.

The shared `legacyscopes.ResolvePermissions` step preserves legacy scope rules and
UID-to-numeric-ID conversion. This stage prepares UID mappings across actions using paginated IAM Lists.
Missing mappings use bounded individual Gets, retaining the UID-scope fallback
on Get errors. The scope resolver documentation describes the namespace-wide
List tradeoff, access requirements, caching and List-error behavior.

## Reusable principal contributions

Each cached contribution contains only that principal's translated grants and
stored dependency references. A user's entry does not contain resolved team or
role grants. A team entry does not contain resolved role grants. Composing the
result follows those dependencies on each request, so Alice and Bob can reuse the
same team and role entries. Empty contributions are cached. Errors and incomplete
reads are not cached. The final user response is not cached.

Request-supplied teams never enter a stored user contribution. Requests for the
same user with different contextual teams can share the user's stored contribution
without sharing contextual memberships.

Entries are isolated by store ID, immutable model ID and typed principal. The cache
honors `[rbac] permission_cache` and uses the shared 60-second permission-cache TTL,
matching legacy permission caches. Its LRU holds at most 10,000 entries. OpenFGA
query-cache settings do not control these contributions. Entries expire from the
start of the read. Reads are coalesced per key and invalidation generation. A
shared load has a 10-second bound, while each waiter can cancel independently.
Principal reads run with concurrency 8. A request is limited to 100,000 tuples and
100,000 distinct principals and returns an error if either limit is exceeded.

`Write`, `Mutate` and reconciliation through `WriteTuples` evict the changed tuple
subjects before and after the local write. An invalidation generation prevents
older in-flight reads from repopulating an evicted entry. Dependencies remain
references, so changing a role evicts that role rather than every referencing user.
Concurrent enumeration and writes are not a transactional snapshot.

Writes through another process or directly to the datastore are observed on cache
expiry. This implementation does not provide distributed invalidation. The RPC's
`skipcache` option bypasses principal caches, including in-flight loads, and
neither populates nor replaces shared entries. It does not bypass the separate
existing IAM UID mapping cache.

Explicit `ReloadCache` options are forwarded to the RPC's `skipcache` flag by the
OSS and Enterprise merge paths, the legacy loader, and the outer AuthZ permission
service. `SkipZanzanaCache` remains an instruction to bypass the caller's flattened
user cache. It does not disable shared principal caching merely because a request
has contextual teams.
