# Legacy scope ID resolution

The user-permissions RPC evaluates grants with OpenFGA before this package formats Grafana action/scope permissions. Individual user and team management scopes need a UID-to-numeric-ID mapping. Folder, dashboard and datasource UID scopes, and wildcard scopes, do not need this mapping.

## Bulk preparation

`ResolvePermissions` collects distinct user and team UIDs across the action results, then calls `UIDResolver.Prepare` before formatting.

For each resource type with an uncached UID, preparation loads the namespace through the existing IAM collection List API. It follows every continuation token with a page limit of 1,000. Users and teams can load concurrently. Callers share concurrent loads for the same namespace and resource type.

A successful load caches all nonzero UID-to-ID mappings and a namespace-load marker for one hour. These are metadata caches, not permission caches. The resolver publishes a load only after every page succeeds.

Mappings still missing after a successful load use individual Gets, with at most eight concurrent Gets per preparation. A request-local result map retains each success or error so multiple actions do not repeat the same lookup. Get failures are not cached across requests.

## Cold-load cost

A single uncached UID can trigger a List of every user or team in its namespace. Finding that UID on the first page does not stop the load. This warms mappings that later requests may need, but it can cost more than an individual Get for a sparse workload.

For a cold namespace with U users and T teams, loading both resource types takes about `ceil(U / 1000) + ceil(T / 1000)` List requests when the server honors that page size. Only resource types with requested cache misses load. For example, one requested user in a namespace with 2,105 users can require three pages. The API returns full objects, and the cache retains mappings for the whole loaded collection.

After a successful load, a newly requested missing UID uses a Get until the namespace-load marker expires. Failed Gets are reused only within that request. Each shared IAM load has a ten-second bound; an individual canceled waiter returns promptly while the shared load may continue for other callers. Large namespaces must complete all pages within that bound.

## IAM access requirements

The previous path needed access to individual IAM user and team Get endpoints. Bulk preparation also needs access to the corresponding namespace-wide collection List endpoints. A caller that can Get a user but cannot List users can fail on its first uncached mapping. The regression tests cover this for users and teams.

Keep Get access for mappings absent from a successful List. Standalone and embedded modes use the existing IAM client and authentication configuration; this change adds no new configuration setting. It does not add an OpenFGA datastore RPC, a direct SQL query, or a Search-index dependency.

## Error behavior compared with individual Gets

| Condition | Individual-Get path | Bulk path |
| --- | --- | --- |
| Get fails | The formatter logs the failure and emits the existing UID scope. Multiple actions may retry the failed lookup. | After a successful List, the formatter keeps the UID fallback. The failed Get is reused across actions for that request. |
| Collection List is forbidden, unavailable, times out, or fails on a later page | No collection List is issued. | Preparation returns an error. It publishes no partial namespace load and does not fall back to a storm of Gets. |
| Get succeeds without a usable numeric ID | The historical formatter can emit an `id:0` scope. Zero is not cached. | Preparation treats zero as unavailable and retains the UID scope instead. Zero is not cached. |

A preparation error propagates from the Zanzana RPC before it sends any permission chunks. The outer permission loader retains its existing handling of Zanzana errors, including its legacy-only fallback. The same bulk preparation is used by the Zanzana permission-search formatter, so collection List failures can also fail those searches instead of producing individual UID fallbacks.

## Coverage

Tests cover full pagination, a single UID triggering all namespace pages, mappings for unrequested UIDs, coalesced namespace loads, cancellation, namespace isolation, failed-page retry without partial cache publication, Get-only access policies, bounded fallback concurrency, and request-local reuse across action aliases.

The RPC fixture checks the same numeric scopes across two requests with one users List, one teams List and no individual Gets. The 2,105-user fixture checks three List pages and zero Gets across two requests. These are request-count checks, not latency guarantees for production namespaces.
