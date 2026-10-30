# User permission enumeration

`GetUserPermissions` returns action/scope pairs using UID scopes for users, teams
and service accounts. It reads relationships through `storage.OpenFGADatastore`,
translates the supported schema into per-action results, formats grant locations,
and streams the complete result. It does not run OpenFGA queries, create a
per-request evaluator, or call IAM to resolve numeric IDs. The datastore can be
remote over gRPC and does not require SQL.

## Translation

`resolveUserPermissionContributions` follows the subject's stored team memberships
and role assignments. Team administration implies membership. Request-supplied
teams add membership only for that request. User, team-member and role-assignee
principals are each read with a user-only datastore filter.

`translatePermissionGrants` reuses the existing action/resource mappings. It
expands view/edit/admin grants, team membership and administration, and local
subresource relations. Group and subresource conditions restrict which actions
receive the grant. Wildcard scopes use group-resource grants. Folder scopes
identify explicit grant locations, including explicit child grants. Folder parent
edges are not traversed to enumerate inherited descendants.

`getStoreInfo` selects or creates the model matching the bundled schema.
Enumeration does not read or compare that model again. Unsupported tuple
subjects, relations, object forms or condition bindings fail before streaming.
Stored conditions may bind only `group_resource` or `subresources`, not the
corresponding request parameters. Tests compare supported grant forms with
OpenFGA using a graph without folder parent edges. Schema changes require review
of the translator.

## Compatibility scopes belong to the permission loader

The shared AuthZ permission loader merges legacy numeric scopes and Zanzana UID
scopes, then adds equivalent ID/UID aliases for users, teams and service accounts.
The local OSS/Enterprise paths and permission search use the same normalizer.
Standalone AuthZ uses it when merging Zanzana permissions. Zanzana itself has no
IAM client or numeric-scope configuration requirement for this RPC.

For example, `teams:read` on `teams:uid:platform` also produces `teams:id:42`
when IAM metadata maps that UID to 42. Legacy `teams:id:42` produces the UID
alias in the other direction. User scopes retain their original `users` or
`global.users` kind. Attribute-specific wildcards receive both ID and UID forms;
broader wildcards already cover both. The output contains unique action/scope
pairs. OpenFGA stores one UID-based relationship; aliases are derived output.

A UID-only object keeps its UID scope. An unavailable or ambiguous mapping keeps
the source grant. Numeric ID zero is never emitted. Request cancellation aborts
the result. Search maps UID filters to numeric filters for legacy storage, then
applies the original filter after alias expansion. Dashboard and folder scope
conventions are preserved.

This stage prepares identity mappings across all merged actions. On a namespace
cache miss, it reads paginated IAM Lists for the required users, teams and service
accounts, then caches both ID-to-UID and UID-to-ID mappings for one hour. Missing
mappings use bounded fallback Gets or narrowly filtered reverse Lists. Known
UID-only objects and confirmed missing mappings are cached for 60 seconds. A
single uncached object can trigger a namespace-wide List. List access is required.
Preparation failure preserves source scopes without starting fallback lookups;
request cancellation fails the result. See the scope resolver README for the
pagination, caching and IAM access tradeoffs.

## Reusable principal contributions

Each cached contribution contains only that principal's translated grants and
stored dependency references. A user's entry does not contain resolved team or
role grants. A team entry does not contain resolved role grants. Composing the
result follows those dependencies on each request, so Alice and Bob can reuse
team and role entries. Empty contributions are cached. Errors and incomplete
reads are not cached. The final user response is not cached by this Zanzana path.

Request-supplied teams never enter a stored user contribution. Entries are
isolated by store ID, immutable model ID and typed principal. The cache honors
`[rbac] permission_cache` and the shared fixed 60-second TTL. Its LRU holds at most
10,000 entries. OpenFGA query-cache settings are independent. Entries expire from
the start of the read. Reads are coalesced per key and invalidation generation.
A shared load has a 10-second bound; each waiter can cancel independently.
Principal reads run with concurrency 8. A request is limited to 100,000 tuples and
100,000 distinct principals and errors if either limit is exceeded.

`Write`, `Mutate` and reconciliation through `WriteTuples` evict changed tuple
subjects before and after a local write. An invalidation generation prevents
older in-flight reads from repopulating an evicted entry. Changing a role evicts
that role rather than every referencing user. Concurrent enumeration and writes
are not a transactional snapshot. Writes through another process become visible
on cache expiry; there is no distributed invalidation.

Explicit `ReloadCache` is forwarded to the RPC's `skipcache` option. This bypasses
principal caches, including in-flight loads, without populating shared entries.
It does not bypass the separate IAM mapping cache. `SkipZanzanaCache` controls the
caller's flattened user cache and does not disable principal reuse for ordinary
requests with contextual teams.
