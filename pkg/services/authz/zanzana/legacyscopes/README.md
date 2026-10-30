# Bulk identity scope aliases

The shared permission loader merges legacy numeric scopes and Zanzana UID scopes,
then calls `WithAliases`. The same normalizer serves local OSS/Enterprise loading
and permission search. Zanzana's RPC returns UID-scoped permissions and performs
no IAM metadata lookup.

`UIDResolver.PrepareScopes` collects references across actions for users, teams
and service accounts. It loads namespace metadata only for resource types with
uncached references. Each paginated List uses a limit of 1,000 and follows every
continuation token. Successful loads cache mappings in both directions, including
objects not requested by the triggering request. Mappings and namespace-load
markers expire after one hour. Concurrent loads share one fetch per namespace
and resource type; the shared fetch is bounded to 10 seconds and each waiter can
cancel independently. Tenant keys use namespace values, not the legacy OrgID.

## Tradeoffs and IAM access

A single uncached UID or numeric ID can trigger a List of the entire namespace
for that resource type. For 2,105 users this means three List pages even if the
requested user appears on page one. This is intentional: later users and actions
reuse the other mappings. The first request transfers and caches more metadata
than an individual Get or filtered reverse List.

IAM credentials require collection List access for users, teams and service
accounts that appear in the permission response. Get access is also needed for
UIDs missing from a successful namespace load. Missing numeric IDs use a filtered
List on `grafana.app/deprecatedInternalID`. Fallback lookups run with concurrency
8, and each distinct reference is resolved once per request.

| Situation | Behavior |
| --- | --- |
| All namespace pages succeed | Publish both mapping directions and the namespace-load marker. |
| A page fails or repeats its continuation token | Publish no partial load; preserve source permission scopes without a fallback storm. |
| Duplicate numeric IDs or conflicting IDs for one UID | Reject the load rather than select an arbitrary alias. |
| A List contains a UID-only object | Cache its missing numeric mapping for 60 seconds; do not issue a fallback Get. |
| A fallback confirms an absent mapping | Cache that absence for 60 seconds. |
| A fallback fails with a transport/server error | Keep the source scope and reuse the failure within that request; do not cache it across requests. |
| Caller cancellation | Abort the permission response; other waiters can continue the shared load. |

Source scopes remain usable when alias preparation fails. Numeric-only consumers
cannot use UID-only grants without a mapping, and a UID-filtered legacy search
cannot recover numeric rows until its filter can be mapped. The optimization
therefore needs List access even where the previous forward lookup needed only
Get access. It does not attempt one Get per object after a collection failure.

Objects without numeric IDs retain their UID scopes. Zero is never emitted as a
numeric scope. User scopes retain the original `users` or `global.users` kind.
Aliases are derived output; OpenFGA relationships are not duplicated. Mapping
caches are separate from the 60-second principal-permission cache.

## Validation

Tests cover pagination, a single reference triggering a full namespace load,
unrequested mappings, both lookup directions, all three identity resources,
namespace isolation, failed-page retry without partial publication, Get-only
policies, cancellation, shared loads, bounded fallback concurrency, UID-only
objects and request-local reuse across action aliases. The 2,105-user fixture
requires three List pages and no Gets across two requests.
