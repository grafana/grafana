# Making your kind searchable

For Grafana engineers who own a kind and want it searchable. You need to know your kind; you do not need to know anything about Bleve or the index.

The endpoint is `POST /apis/{group}/{version}/namespaces/{namespace}/{resource}/search`. It is on by default (`[grafana-apiserver] enable_search_api`, default `true`), so you can make a kind searchable without asking the search and storage team.

This is `v0alpha1`. Shapes can change.

## Prerequisite: your kind's data must be in unified storage

**Check this first.** Search reads an index built from unified storage. It cannot read legacy data. `/trash` reads the same index, so all of this applies to it too.

If your kind's resources still live in legacy storage, everything below will appear to work. The endpoint mounts, your fields validate, requests return `200`, and **every search comes back empty**. Nothing in the response explains why, and declaring more fields does not help.

A resource is in one of three storage states (`StorageMode` in `pkg/storage/unified/migrations/contract/migrations.go`). **Use `/search` only in the third.** Nothing enforces that, so here is what goes wrong in the other two:

- **Legacy**: reads and writes are legacy only. Unified storage holds nothing, so every search returns an empty result.
- **Dual-write**: writes go to both stores and reads are served from legacy. The unified write is best effort and does not block, so some resources never make it into the index. Searches then return **wrong results rather than no results**: some resources are missing and nothing says so. This is the worst state to search in, because it looks like it is working.
- **Unified**: reads and writes both go to unified storage. This is the state search is built for.

Configured modes map onto those states: `Mode0` or no entry is legacy, `Mode1`, `Mode2` and `Mode3` are all dual-write, and `Mode4` and `Mode5` are unified. A completed migration also means unified, whatever the config says. So the older per-mode distinctions no longer decide anything: `Mode3` used to read from unified storage, and today it does not.

A new kind built on unified storage from the start is in the unified state already, with no legacy data behind it.

IAM shows how this catches people out: its own search falls back to legacy SQL when data has not migrated, so it keeps working. `/search` has no such fallback and returns an empty result instead.

## 1. Getting the endpoint

Declare at least one search field in the kind's own `.cue` file, the file where you already declare `schema` and `selectableFields`, not `manifest.cue`. Then run `make gen-apps`.

Example, from `apps/iam/kinds/user.cue`:

```cue
searchFields: [
	{
		name: "email"
		path: "spec.email"
		type: "string"
		capabilities: ["filter", "sort", "retrieve"]
		description: "The email address of the user"
	},
]
```

Two conditions besides the fields:

- The kind must be namespaced. A cluster-scoped kind has no namespace to search within, so it gets no endpoint (`pkg/services/apiserver/searchroutes/searchroutes.go`).
- The group version has to be one this process actually serves.

### The field requirement is temporary

Declaring a field is not what makes search work. This requirement is temporary, until we review kinds before enrolling them automatically. A kind with only the standard fields works fine. Folders are the live example, kept working by an allowlist in `searchroutes.go`.

The plan is to drop the requirement. After that, **every kind in a manifest gets the endpoint unless it opts out**. So:

- If you want your kind searchable, it will be, whether or not you declare fields. Declaring them now just gets you there sooner.
- If you do not want your kind searchable, declaring no fields will not stop it. Write the opt-out down (next section).

At that point `searchFields` only controls **what callers can query and retrieve**, not whether the endpoint exists.

## 2. Opting out

Both endpoints default to on in the SDK, so an opt-out is the only thing worth writing down. There is no reason to write `endpoint: true`:

```cue
search: {
	endpoint: false
}
```

```cue
search: {
	trash: false
}
```

Kind-level, and note the colon: `search: { ... }`. Brace shorthand is not valid CUE here. Definition: `#KindSearch` in the app SDK's `codegen/cuekind/def.cue`.

`endpoint: false` turns off `/search`, `trash: false` turns off `/trash`. They are separate because trash authorizes on a different rule that has not been reviewed yet, and it is off deployment-wide today anyway (`enable_trash_api` defaults to `false`).

The opt-out works today and keeps working after the field requirement is dropped.

Opting out should be rare, though. Search exposes nothing that listing your kind did not already expose (see [Authorization](#7-authorization)), so there is usually nothing to protect by opting out. If you are unsure, leave the default alone.

## 3. Declaring fields

Per field:

- `name`: the name callers use in queries and see in results. Must not collide with a standard field.
- `path`: the JSON path that supplies the value, for example `spec.email` or `spec.members[*].name`. Omit it only if a custom document builder fills the field in.
- `type`: one of `string`, `int64`, `double`, `boolean`, `date`.
- `array`: the field holds a list of values of that type.
- `capabilities`: what callers may do with the field. Nothing is implied; a field with no capability is indexed and unusable.
- `emitZeroIfAbsent`: index the type's zero value when the path resolves to nothing. Without it a document missing the path omits the field, which matters for sort and range.
- `description`: informational only, never affects the index.

Capabilities:

| Capability | What it allows |
| --- | --- |
| `filter` | Exact matching on a value or set of values: `In` and `NotIn`. |
| `text` | Free-text search over the field's tokens. |
| `partial` | Substring matching. Requires `text`. Costs index size. |
| `sort` | The field may be named in `sort`. |
| `facet` | The field may be named in `facets`, returning term counts. Counts are approximate, see [Faceting](#faceting). |
| `retrieve` | The value is stored and can come back in results. **Without this the field is never returned.** |
| `unranked` | Text fields only: drop the ranking statistics to save space. Use when the field is searched but never ranked on. |

Type rules, enforced at codegen and at startup (`pkg/storage/unified/resource/search_field.go`): `text`, `partial` and `facet` need a string type; `sort` works on string, numeric and boolean; `filter`, `retrieve` and `unranked` work on any type. Query-time validation is a little narrower still, see [Other things worth knowing](#other-things-worth-knowing).

### Changing declared fields rebuilds indexes

Changing a field's `name`, `path`, `type`, `array`, `capabilities` or `emitZeroIfAbsent` moves the index-affecting hash, and every index for that kind is rebuilt. Adding or removing a field does the same. `description` is deliberately excluded, so wording changes are free.

This is not a reason to avoid changing fields. There are only a handful of dev instances but many production ones, so most of the rebuilding happens in production, and it is still usually fine: the cost depends on how many resources of your kind there are, not on how many instances rebuild. For on-prem installs it is normally negligible. It only becomes something to plan around when a kind has a very large number of resources to reindex. Worth knowing about, and worth batching a few field changes into one release.

### Fields and versions

Search fields are declared per version, which matters in two places:

- **When indexing**, a resource is described by the declarations of the version it is stored as. If `v1` and `v2` give a field different `path` values, each document uses the path from its own stored version.
- **When searching**, the version in the request URL decides which fields you can name. A field only declared in `v2` is unknown to a search against `v1`, and referencing it returns 422.

The index mapping itself is shared per group/resource, so `type`, `array` and `capabilities` must agree across versions for a field of the same name; startup rejects declarations that disagree. `path`, `emitZeroIfAbsent` and `description` may differ.

That is how the current implementation behaves. How it works out for developers once real kinds have several live versions is something we will learn in practice. The constraint to design around is that a field of the same name has to mean almost the same thing in every version that declares it, so the safe approach for now is to declare the same fields in every served version.

### Standard fields, available by default

Every kind can query and retrieve these without declaring anything. They are the same for every kind, and come from `StandardSearchFieldDefinitions` in `pkg/storage/unified/resource/standard_search_fields.go`, which is built into every index.

"Read from" is where the value comes from in your resource, so you can tell what you get for free and what needs declaring. Populated by `NewIndexableDocument` in `pkg/storage/unified/resource/document.go`.

| Field | Type | Capabilities | Description | Read from |
| --- | --- | --- | --- | --- |
| `name` | string | filter, sort | Kubernetes name, unique within namespace + group + resource | `metadata.name` |
| `title` | string | filter, text, partial, sort, retrieve | Display name | `spec.title`, or the kind's own title lookup. Falls back to the name |
| `description` | string | text, retrieve | Free-text description | `spec.description` |
| `tags` | string array | filter, facet, retrieve | Unique tags | `spec.tags`. Non-string entries are skipped |
| `folder` | string | filter, sort, retrieve | Kubernetes name of the containing folder | The `grafana.app/folder` annotation |
| `createdBy` | string | filter, retrieve | Who created it, as `user:<uid>` | The `grafana.app/createdBy` annotation |
| `ownerReferences` | string array | filter, retrieve | Owner references, as `{group}/{kind}/{name}` | `metadata.ownerReferences` |
| `managedBy` | string | facet | Manager identity, as `{kind}:{id}` | Manager properties |
| `created` | int64 | retrieve | Creation timestamp, unix millis | `metadata.creationTimestamp` |
| `updated` | int64 | retrieve | Update timestamp, unix millis | The `grafana.app/updatedTimestamp` annotation |

So `title`, `description` and `tags` come from your spec: name them that way and they are indexed with no work from you. A kind with its own document builder can overwrite any of these, as dashboards do from their parsed summary.

Note that `created` and `updated` only declare `retrieve`. They can be returned, but they cannot be filtered, sorted or used in a range query, so "everything updated in the last week" is not a query you can write today. This is a limitation of the standard fields rather than something for your kind to work around, and it is likely to change: if you need it, say so and the standard fields can be given those capabilities.

## 4. Request

```json
POST /apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards/search
{
  "apiVersion": "search.grafana.app/v0alpha1",
  "kind": "SearchQuery",
  "where": {
    "and": [
      { "text": { "value": "saturation", "fields": ["title", "description"] } },
      { "filter": { "field": "folder", "operator": "In", "values": ["my-folder"] } }
    ]
  },
  "labelSelector": {
    "matchLabels": { "team": "observability" },
    "matchExpressions": [
      { "key": "env", "operator": "In", "values": ["prod", "staging"] }
    ]
  },
  "sort": [{ "field": "title", "direction": "asc" }],
  "fields": ["title", "folder"],
  "facets": ["tags"],
  "limit": 50
}
```

Watch out for the two different `fields`. The one inside the `text` leaf says which fields the text is matched **against**. The one at the top level says which fields are **returned**. They are unrelated, and in the example above the search matches on `title` and `description` but returns `title` and `folder`.

Two different versions appear here, which is easy to misread. The **URL** carries your kind's group and version (`dashboard.grafana.app/v1beta1`), because the endpoint is mounted on your kind and on every version of it that is served. The **body** carries `search.grafana.app/v0alpha1`, because the request and response envelope is its own type in its own group, shared by every kind.

In practice that means when your kind graduates from `v1beta1` to `v1`, the URL changes and the body does not. When the search API graduates from `v0alpha1`, the body changes and every kind's URL stays as it is.

`apiVersion` and `kind` in the body are required and must be exactly those values. Unknown top-level keys are rejected.

**`where`** is a predicate tree. Today it accepts either a single leaf, or a single `and` of leaves. Leaf types:

- `text`: the free-text query, the thing a user types into a search box. `value` is required. `text.fields` says which fields to match it against, defaulting to `title`, and each field named there needs the `text` capability. At most one text leaf. Omitting `text` is fine and common: the query then matches on the other leaves alone, results come back ordered by `name` rather than by relevance, and no `score` is returned.
- `filter`: `field`, `operator` (`In` or `NotIn`), `values`. Values are always strings, whatever the field's type: a boolean field takes `"true"` or `"false"`, a number is written out. `*` in a value is rejected.
- `range`: numeric fields only, and the field must declare `filter`. There is no separate range capability, so a field you cannot filter is also a field you cannot range over. `gt`/`gte`/`lt`/`lte`, at least one bound, and you cannot combine `gt` with `gte` or `lt` with `lte`. On an `int64` field bounds must be whole numbers.

Omitting `where` matches everything of that kind in the namespace, subject to authorization.

`or`, `not` and `exists` are in the schema for later and rejected today.

**`labelSelector`** is a standard Kubernetes label selector on `metadata.labels`, ANDed with `where`. It takes the same `matchLabels` and `matchExpressions` shape you would pass to `kubectl` or a list call, as in the example above, and supports the `In` and `NotIn` operators.

**`sort`** is a list of `{field, direction}`, direction `asc` (default) or `desc`. The field must declare `sort`. With no sort: results come back by `name` ascending, or by relevance if the query has a text leaf.

**`fields`** selects which fields to return. Each must declare `retrieve`; naming one that does not is rejected with 422, not silently dropped. Default is `title` and `folder`.

**`facets`** and **`facetLimit`** name fields to count terms on; each must declare `facet`. `facetLimit` applies to every facet, defaults to 50, capped at 1000.

**`limit`** and **`continue`** page the results. Page size defaults to 100 and is capped at 500. Pass `metadata.continue` from the previous response back as `continue` to get the next page. The token is opaque: do not build or parse one.

Large integers lose precision. Numeric values pass through float64 twice: range bounds in the request body are JSON numbers decoded into float64 (`RangePredicate` in `pkg/apis/search/v0alpha1/types.go`), and Bleve stores every numeric field as float64. Above 2^53, neighbouring integers share one float64 representation, so a filter or a sort cannot tell them apart, and a range bound can admit a value next to the one you asked for. Resource versions are the usual example: they sit around 1.8e18, where only every 256th integer is representable. If your field holds values that large, declare it as a `string`, which is what the deleted resource version field does.

### Faceting

Treat facet counts as approximate, and do not use them where an exact number matters.

Counts come from the full match set today. That does not scale once a kind has a lot of documents, so we are going to change it.

The sampled path already exists: when per-item authorization runs after ranking, counts are aggregated over a bounded sample of matching documents rather than all of them (`FacetSampleSize` in `pkg/storage/unified/search/bleve_postrank_authz.go`), so a term's count can come back lower than the real number. That mode is being tested now and is expected to become the default, which is what will make sampled counts the normal case rather than an edge case. Write clients that tolerate approximate counts from the start.

## 5. Response

```json
{
  "apiVersion": "search.grafana.app/v0alpha1",
  "kind": "SearchResults",
  "metadata": {
    "continue": "W3RpdGxlLi4uXQ",
    "totalHits": 3,
    "totalHitsRelation": "eq"
  },
  "items": [
    {
      "resource": { "group": "dashboard.grafana.app", "resource": "dashboards", "kind": "Dashboard", "name": "cpu" },
      "score": 1.42,
      "fields": { "title": "CPU saturation", "folder": "my-folder" }
    }
  ],
  "facets": {
    "tags": [{ "value": "prod", "count": 12 }]
  }
}
```

- `resource` is the full identity of the hit. Namespace is implicit from the URL.
- `score` appears only when the query had a text leaf.
- `fields` carries the requested fields; array fields come back as JSON arrays, absent values are omitted.
- `totalHits` must be read together with `totalHitsRelation`. `eq` means the count is exact. `lte` is short for "less than or equal to": the real number is at or below `totalHits`, which the server falls back to when counting exactly would be too expensive.
- `facets` counts are approximate, as above.
- `metadata.continue` present means ask again for more. An empty string means you are done. You may occasionally get one extra empty page.

## 6. Errors

- **422 Unprocessable Entity**: the request parsed but is not valid. A field your kind does not declare, a field missing the capability the request needs, an unsupported operator, a `not`/`or`/`exists` node, a second text leaf. The response body names the offending field path.
- **400 Bad Request**: the request could not be understood. Malformed JSON, an unknown top-level key, an empty body, more than one JSON object, a missing namespace, or `namespace=*`. Searching across namespaces is not supported.
- **405 Method Not Allowed**: the kind is served, but has no search endpoint. It declares no search fields, it opted out, or it is cluster-scoped. No route is mounted, so the router answers before any search code runs.
- **404 Not Found**: the resource itself is not served by this apiserver.

## 7. Authorization

A search POST is parsed by Kubernetes as a create on an object named `search`. The authorization chain restates it as a **`list` on your kind's own resource** (`pkg/services/apiserver/auth/authorizer/search.go`), so:

- The permission needed is `<group>/<resource>:list`. Nobody needs create permission to search.
- **`/search` exposes nothing that listing your kind did not already expose.**

Individual results are then filtered per item using the same access client that `list` uses, and that check fails closed.

## Other things worth knowing

- **Unified storage only**, and a kind whose data has not migrated returns an empty result rather than an error. This is the most common reason search appears not to work, see the prerequisite at the top.
- **The first request for a kind may wait for an index build.** Indexes are created on demand.
- **Trash is off today**, so declaring search fields gets you `/search` only. That is expected to change: `/trash` is planned to be on by default, and kinds that do not want it will need `trash: false`. Worth knowing now if a deleted-items list would be wrong for your kind.
- **Sorting** works on any indexed field that declares `sort`. One exception: non-string retrieve-only fields fall back to the `name` tie-breaker instead of failing, so `created` and `updated` cannot be sorted on.
- **A field without `retrieve` cannot be returned**, even if you can filter on it.

## Where to look

- `pkg/apis/search/v0alpha1/types.go`: the only authority on the public request and response shape
- `route.go`, `handler.go`, `translate.go` in this package: validation and error codes
- `pkg/storage/unified/resource/search_field.go`: field definitions, capabilities, the index-affecting hash
- `pkg/storage/unified/resource/standard_search_fields.go`: the standard fields
- `pkg/services/apiserver/searchroutes/searchroutes.go`: how routes are mounted, including the temporary field requirement
- `pkg/tests/apis/dashboard/searchapi_test.go`: a working end-to-end example
