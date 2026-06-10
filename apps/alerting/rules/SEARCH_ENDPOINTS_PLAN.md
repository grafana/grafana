# Plan: Search endpoints for AlertRule / RecordingRule resources

Tracking issue: [alerting-squad#1756](https://github.com/grafana/alerting-squad/issues/1756) — _Align on filtering behavior and API support_.

## Implementation status

**Landed (committed):**

- The three namespaced custom routes (`/search`, `/search/alertrules`, `/search/recordingrules`)
  with generated request-params and response/hit types.
- A **legacy** search backend: a handler backed by the provisioning `AlertRuleService`.
  Selector-expressible filters are pushed to the service; free-text title, rule-label matchers
  (plugin-origin via a label existence check), and source-datasource filters run in memory, with
  title/group sorting and offset pagination.
- Unit tests for the filter/sort/paginate logic and an e2e test (runnable under multiple
  dual-writer modes).

**Next — mode-routed legacy/unified search (the agreed target architecture).** The search must be
part of the k8s-client path and alternate between the legacy and unified backends by the resource's
dual-writer mode, using the built-in router rather than a bespoke switch. Concrete plan with
references:

1. **Wrap legacy as a `resourcepb.ResourceIndexClient`.** Mirror
   [pkg/registry/apis/iam/team/legacy_search.go](../../../pkg/registry/apis/iam/team/legacy_search.go)
   (`LegacyTeamSearchClient`): embed `resourcepb.ResourceIndexClient`, implement only `Search` by
   reading filters/sort/limit/page out of the `ResourceSearchRequest` (reusing the existing
   `query.go` logic) and emitting a `ResourceTable` (columns + rows keyed by rule UID).
2. **Route by mode with the built-in wrapper.**
   `resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), gr, unifiedClient, legacyClient)`
   ([pkg/storage/unified/resource/search_client.go](../../../pkg/storage/unified/resource/search_client.go)).
   It dispatches per-request via `dual.ReadFromUnified(ctx, gr)` (modes 0–2 → legacy, 3+ → unified),
   with shadow-traffic/metrics built in.
3. **Index rules for the unified path.** Add AlertRule/RecordingRule document builders under
   [pkg/storage/unified/search/builders/](../../../pkg/storage/unified/search/builders/) (mirror
   `dashboard.go`) declaring the searchable columns (title, folder, group, paused, source DS,
   labels) and register them in `builders.All`.
4. **Wire dependencies.** Add `resource.ResourceClient` and `dualwrite.Service` to
   `RegisterAppInstaller` (both are existing DI providers); regenerate wire.
5. **Reshape the handler + response.** The router returns `ResourceSearchResponse` (a `ResourceTable`
   of indexed columns), so hits become **indexed-column summaries** (like `DashboardHit`), not full
   `metadata + spec`. Update the CUE response/hit types accordingly and mirror
   [pkg/services/dashboards/service/search/search.go](../../../pkg/services/dashboards/service/search/search.go)
   `ParseResults` to turn rows into hits.
6. **Verify both modes** (e2e under legacy and unified dual-writer modes; the unified path needs a
   running storage+search backend to validate).

**Note on rules as source of truth:** the ngalert SQL store is what the alerting engine evaluates
from. The unified path is for serving the k8s read/search surface as rules migrate to unified
storage; engine evaluation moving off the SQL store is a separate, larger migration.

## Goal

The current rule list UI is powered by the old Prometheus endpoint
(`GET /api/prometheus/grafana/v1/rules`), which serves **config + runtime state** and supports
substring/path search. The new K8s rule endpoints (`rules.alerting.grafana.app/v0alpha1`) only
support `labelSelector` / `fieldSelector` over **config (spec) only**, with exact-match semantics.

We want a richer **search** capability on the rule resources that can serve the **config-level**
filters the rule list relies on (see the matrix in #1756), implemented so it works in both
**legacy** (ngalert SQL store) and **unified** (app-platform storage + search index) deployment
modes.

We want two shapes of search:

1. A **cross-kind** search that returns both alert rules and recording rules from one request.
2. A **per-kind** search for `alertrules` and `recordingrules` that exposes each kind's specific
   filters (e.g. notification settings vs `targetDatasourceUID`).

### Out of scope (deferred)

**`state` and `health` filtering/sorting are explicitly deferred.** They are runtime properties of
the alerting engine, not of the config resource, so they require a different data source (the
Prometheus/state API merge) and a different implementation. This plan covers config-level search
only; state/health is a follow-up effort. See [Deferred work](#deferred-work).

This document describes _how_ to add the search endpoints and the trade-offs to weigh. It does not
contain code.

---

## Background: what exists today

### Selectors on the rule resources

Field/label selectors are parsed in
[pkg/registry/apps/alerting/rules/common/selectors.go](../../../pkg/registry/apps/alerting/rules/common/selectors.go)
and applied in the legacy storage `List` implementations:

- [alertrule/legacy_storage.go](../../../pkg/registry/apps/alerting/rules/alertrule/legacy_storage.go)
- [recordingrule/legacy_storage.go](../../../pkg/registry/apps/alerting/rules/recordingrule/legacy_storage.go)

Supported today (all exact-match):

|                   | labelSelector                             | fieldSelector                                                                                                                               |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **AlertRule**     | `grafana.app/folder`, `grafana.com/group` | `spec.title`, `spec.paused`, `spec.panelRef.dashboardUID`, `spec.panelRef.panelID`, `spec.notificationSettings.{type,receiver,routingTree}` |
| **RecordingRule** | `grafana.app/folder`, `grafana.com/group` | `spec.title`, `spec.paused`, `spec.metric`, `spec.targetDatasourceUID`                                                                      |

These map onto `ngmodels.ListAlertRulesOptions` (`RuleType`, `TitleFilter`, `GroupFilter`,
`FolderFilter`, `PausedFilter`, `DashboardFilter`, `PanelIDFilter`, `ReceiverFilter`, `MetricFilter`,
`TargetDatasourceUIDFilter`, …) which the backing `provisioning.AlertRuleService.ListAlertRules`
understands. Field-selector operators are limited to `=`, `==`, `!=`; single value per field. Note
that both rule types live in the same `alert_rule` table and `ListAlertRules` already serves both —
`RuleType` discriminates — which is what makes a cross-kind search natural in the legacy backend.

### Config-level gaps the search endpoint must close (from #1756)

- **Label matching** on rule labels (`label:team=A`) — rule labels live in `spec.labels` as
  template strings (`"{{ $labels.severity }}"`), which are **not** promotable to K8s
  `metadata.labels` (see [alertrule/compat.go](../../../pkg/registry/apps/alerting/rules/alertrule/compat.go)),
  so they have no `labelSelector`/`fieldSelector` path.
- **Source-datasource filter** for both kinds — the datasource a rule's queries run against lives
  in `spec.expressions[*].datasourceUID` and has no selector path today. (Distinct from
  RecordingRule's `spec.targetDatasourceUID`, the write target, which _is_ already selectable.)
- **Plugins** hide/only — derivable from the `__grafana_origin` spec label but not selectable today.
- **Degraded — exact-match only today:** rule name (no substring), folder (UID only, no path
  search), group (no substring).

**Net-new in K8s:** `spec.paused`.

> **Deferred (not in this plan):** `state` (firing/normal/pending/recovering) and `health`
> (ok/nodata/error). These are not properties of the config objects — the only `status` is
> `operatorStates` (reconcile state). They require the alerting-engine merge that the old Prometheus
> endpoint (`RouteGetRuleStatuses`) performs.

---

## Reference: how dashboard search works

[pkg/registry/apis/dashboard/search.go](../../../pkg/registry/apis/dashboard/search.go) is the model
to follow. Key points:

- It is a **namespace-scoped collection route** mounted at
  `/apis/dashboard.grafana.app/v0alpha1/namespaces/{namespace}/search` — **not** a per-object
  subresource. A `type=dashboard|folder` query param selects which kind(s) to search, and it
  **federates** across kinds (`searchRequest.Federated`) to return both in one response.
- The handler converts HTTP query params into a `resourcepb.ResourceSearchRequest` and calls
  `s.client.Search(...)` on the unified `ResourceIndexClient`.
- The **unified search index** is defined by a _document builder_
  ([pkg/storage/unified/search/builders/dashboard.go](../../../pkg/storage/unified/search/builders/dashboard.go)),
  declaring the searchable/filterable/free-text columns and extracting them from each object.
- **Legacy vs unified is transparent to the handler**: the `ResourceIndexClient` routes internally.
  Legacy SQL search modes (0–2) use page-based pagination; unified/bleve modes (4+) use
  offset + facets + scored query fields.
- Response DTOs (`SearchResults`, `DashboardHit`, `SortableFields`) live in the dashboard
  `v0alpha1` apis package.

**Crucial difference for us:** the alerting rules app is **not** a hand-written `APIGroupBuilder`.
It is a **grafana-app-sdk `AppInstaller`**
([pkg/registry/apps/alerting/rules/register.go](../../../pkg/registry/apps/alerting/rules/register.go)),
so it does not get `builder.APIGroupRouteProvider`. Custom routes for app-sdk apps are declared in
the **manifest** and handled by the **App** — see next section.

---

## How custom routes work for app-sdk apps (v0.56.0)

The app-sdk supports three flavors of custom route (`grafana-app-sdk/app/manifest.go`,
`grafana-app-sdk/k8s/apiserver/installer.go`, `grafana-app-sdk/simple/app.go`):

1. **Kind-scoped routes** (`manifestKind.Routes`) → object subresources
   `/namespaces/{ns}/alertrules/{name}/<route>`. **Per-instance**, wrong for a collection search.
2. **Version namespace-scoped routes** (`version.Routes.Namespaced`) → `/namespaces/{ns}/<route>`.
   **This is the dashboard-search equivalent** — collection-level, namespace-scoped. ✅
3. **Version cluster-scoped routes** (`version.Routes.Cluster`).

Handlers are registered on the App (`simple.AppConfig.VersionedCustomRoutes` →
`AppCustomRouteHandlers`, keyed by `{Namespaced bool, Method}` and path) and dispatched via the
App's `CallCustomRoute`. The installer turns each declared route into a `SubresourceConnector` whose
`Handler` calls `app.CallCustomRoute(ctx, writer, request)`. Response/query Go types are resolved
through the `GoTypeAssociator`
([apps/alerting/rules/pkg/apis/manifestdata/alerting_manifest.go](pkg/apis/manifestdata/alerting_manifest.go)),
populated by codegen from the CUE manifest.

Route keys must not collide with kind plural names (`alertrules`, `recordingrules`,
`rulesequences`). Prefixing per-kind search routes with `search/` avoids that.

---

## Proposed endpoints

```text
GET /apis/rules.alerting.grafana.app/v0alpha1/namespaces/{namespace}/search                 # cross-kind
GET /apis/rules.alerting.grafana.app/v0alpha1/namespaces/{namespace}/search/alertrules      # alert rules
GET /apis/rules.alerting.grafana.app/v0alpha1/namespaces/{namespace}/search/recordingrules  # recording rules
```

All three are **version namespace-scoped routes**. They share one core implementation parameterized
by **which kinds to include** and **which filter set is exposed**:

- `search` includes both kinds. Common filters only; an optional `type=alertrule|recordingrule`
  narrows results (matching dashboard's `type=`). Each hit carries a `type` discriminator.
- `search/alertrules` pins the kind to AlertRule and additionally exposes the alert-only filters
  (`dashboardUID`, `panelID`, `receiver`, `notificationType`, `routingTree`).
- `search/recordingrules` pins the kind to RecordingRule and exposes recording-only filters
  (`metric`, `targetDatasourceUID`).

The per-kind routes are thin wrappers: they pin the kind and expose the kind-specific params; the
cross-kind route is the same core with both kinds and the common param subset.

### Query parameters → filter mapping

**Common (all three endpoints):**

| Query param                                    | Backed by                                                                        | Notes                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `query` (free text)                            | title substring (+ optionally group/folder name)                                 | scored substring; not exact-match                              |
| `folder`                                       | `FolderFilter` (UID)                                                             | UID exact today; folder **path/name** search is a gap to close |
| `group`                                        | `GroupFilter`                                                                    | add substring support                                          |
| `paused`                                       | `PausedFilter`                                                                   | exact (net-new vs old endpoint)                                |
| `label` (`k=v`, repeatable)                    | rule `spec.labels` match                                                         | **new** — gap; server-side `=`/`!=`, regex client-side         |
| `datasourceUID`                                | **source/query** datasource — extracted from `spec.expressions[*].datasourceUID` | **new** — both kinds; see note below                           |
| `plugins` (hide/only)                          | existence of `spec.labels["__grafana_origin"]`                                   | **new** — config-derivable, so indexable                       |
| `sort`                                         | title / group / folder (repeatable, `-` prefix = desc)                           | see [Sorting](#sorting); state/health sort **deferred**        |
| `limit` + `continueToken` (or `offset`/`page`) | pagination                                                                       | see pagination note                                            |
| `facet` / `facetLimit`                         | distinct-term counts                                                             | optional, unified-mode only                                    |

**`search/alertrules` only:** `dashboardUID`, `panelID`, `receiver`, `notificationType`, `routingTree`.

**`search/recordingrules` only:** `metric`, `targetDatasourceUID`.

> **Source datasource (`datasourceUID`) vs `targetDatasourceUID` — they are different filters.**
> Both rule kinds carry `spec.expressions` (a shared `#ExpressionMap`, i.e.
> `map[string]#Expression`); each expression may set `datasourceUID` — the datasource the query runs
> **against** (omitted/`__expr__` means a server-side expression node, which must be excluded). The
> `datasourceUID` filter matches a rule whose expression map references the given source datasource,
> and applies to **both** AlertRule and RecordingRule. This is distinct from RecordingRule's
> `spec.targetDatasourceUID`, which is the datasource the recorded metric is **written to**. A rule
> can have many source datasources (one per query node) but at most one target. The filter therefore
> matches against the _set_ of source UIDs extracted from the expression map.
>
> **`plugins`:** a rule is "plugin-owned" iff `spec.labels["__grafana_origin"]` is present. `hide`
> excludes those rules; `only` returns just those. Since this is a plain spec-label lookup it is
> config-derivable and can be indexed (no runtime lookup needed).

Response DTO: a `RuleSearchResults` / `RuleHit` pair modeled on
`dashboardv0alpha1.SearchResults` / `DashboardHit`, plus `SortableFields`. `RuleHit` carries a
`type` discriminator (`alertrule` | `recordingrule`), the rule identity (name/UID, title, folder,
group), and the config fields the UI needs; kind-specific extras can hang off a
`Field *common.Unstructured` (as dashboards do for `panel_types` etc.) to keep the hit shape uniform
across the cross-kind endpoint.

### Sorting

`sort` is a repeatable query param; a `-` prefix means descending (the dashboard convention). The
declared `SortableFields` for v1 are `title` and `group` (config-level fields the index/SQL can
order on); `folder` is a candidate if the UI needs it. **State/health sorting is deferred** with the
rest of the runtime work.

**Default sort is title/relevance; group sorting is opt-in** (`sort=group`). Even though the current
rule list is group-oriented, we keep the default unopinionated and let the client request group
ordering explicitly.

**Sorting by group** is the interesting case because a "group" is a cluster of rules with an
intra-group evaluation order, not just a scalar key. To keep results coherent, sort by group as a
compound key: **`(folder, group name, group-index, title)`**. `group-index`
(`grafana.com/group-index`, already present on the resource) preserves each rule's position within
its group; `title` is the stable tiebreaker. So `sort=group` yields groups in name order with each
group's rules in evaluation order, rather than a flat shuffle.

This composes cleanly with the cross-kind interleave decision: a rule group can contain **both**
alert and recording rules, so interleaving the two kinds _within_ a group is the correct behavior —
sorting by group naturally produces it.

- **Unified backend:** declare `group` (and `group-index`) as sortable index columns and pass the
  compound sort into `ResourceSearchRequest.SortBy`.
- **Legacy backend:** `ListAlertRules` returns the bounded namespace result set; apply a stable
  in-memory sort on the compound key in the handler (mirroring how dashboard search applies its
  default in-memory ordering to parsed results). Revisit pushing `ORDER BY` into the store only if
  result-set size makes in-memory sorting a problem.

---

## Legacy vs unified implementation

The handler is backend-agnostic at the HTTP layer (parse params → build a backend-neutral
`SearchQuery` → render results), with two implementations behind a `RuleSearchBackend` interface,
selected the same way the rest of the rules storage selects legacy vs unified (dual-writer mode in
[pkg/services/apiserver/appinstaller/server.go](../../../pkg/services/apiserver/appinstaller/server.go)).

### Legacy backend (available now, ship first)

- Translate the `SearchQuery` into `ngmodels.ListAlertRulesOptions` and call
  `provisioning.AlertRuleService.ListAlertRules` — reuse the path the legacy `List` storage uses.
  Cross-kind = no `RuleType` (or both); per-kind pins `RuleType`.
- Substring title/group/folder, `label` match, and query-`datasourceUID` filters that the options
  struct doesn't support yet are either (a) added to `ListAlertRulesOptions` + the SQL query, or
  (b) applied as a post-filter in the handler. Prefer (a) for anything that affects pagination
  correctness; (b) is acceptable for cheap, low-cardinality post-filters.

### Unified backend

- Requires a **document builder** for AlertRule and RecordingRule under
  [pkg/storage/unified/search/builders/](../../../pkg/storage/unified/search/builders/) (mirroring
  `dashboard.go`), declaring searchable/filterable columns: title (free-text + phrase + ngram for
  substring), folder, group, paused, plus per-kind columns (dashboardUID, panelID, receiver, metric,
  targetDatasourceUID), the **query datasource UIDs**, and **rule labels** as a multi-valued field.
  The labels + query-DS columns are the index-side answer to the gaps that selectors can't express.
- The handler builds a `resourcepb.ResourceSearchRequest` and calls `ResourceIndexClient.Search`,
  exactly like dashboards. Cross-kind search sets `Options.Key` to one kind and `Federated` to the
  other (the dashboard↔folder federation pattern).

### Shared shape

```text
parse query params ──▶ build backend-neutral SearchQuery (kinds + filters)
                           │
            ┌──────────────┴──────────────┐
       legacy backend                unified backend
   (ListAlertRules + SQL)       (ResourceIndexClient.Search, federated for cross-kind)
            │                              │
            └──────────────┬───────────────┘
                    render RuleSearchResults
```

---

## Implementation tasks

Grouped into phases; phases 1–2 deliver a working end-to-end legacy search, phase 3 adds the unified
index, phase 4 is polish.

### Phase 1 — Scaffolding (DTOs + routes)

- **T1. DTOs (CUE).** Define `RuleSearchResults`, `RuleHit` (with `type` discriminator),
  `SortableFields`, and the request query type in `apps/alerting/rules/kinds/`.
- **T2. Manifest routes.** Declare the three namespace-scoped routes (`search`, `search/alertrules`,
  `search/recordingrules`) under `versions.v0alpha1.routes.namespaced` in
  [kinds/manifest.cue](kinds/manifest.cue), with their OpenAPI param/response specs.
- **T3. Codegen.** Run `make gen-cue` / `make gen-apps`; verify the generated Go types, OpenAPI, and
  `GoTypeAssociator` route associations.
- **T4. Backend-neutral core.** A `SearchQuery` struct + parser from `url.Values` (mirror
  `convertHttpSearchRequestToResourceSearchRequest`), and a `RuleSearchBackend` interface with the
  kinds + filter set parameterized so the three routes share one core.

### Phase 2 — Legacy backend + wiring

- **T5. Param → options translation.** Map `SearchQuery` to `ListAlertRulesOptions`; cross-kind vs
  per-kind via `RuleType`.
- **T6. Extend legacy filtering.** Add to `ListAlertRulesOptions` + the SQL query (or handler
  post-filter where appropriate): substring title/group; `label` match; source-`datasourceUID`
  match (extract source UIDs from each rule's `expressions[*].datasourceUID`, excluding `__expr__`);
  and `plugins` (presence of the `__grafana_origin` spec label). Folder stays exact-UID for v1.
- **T7. Handler registration.** Implement the `AppCustomRouteHandler`s and register them via
  `simple.AppConfig.VersionedCustomRoutes` in [apps/alerting/rules/pkg/app/app.go](pkg/app/app.go);
  pass the ngalert services the handlers need through `RuntimeConfig` /
  [register.go](../../../pkg/registry/apps/alerting/rules/register.go). Confirm we can read query
  params + requester identity from `app.CustomRouteRequest` and render errors as `apierrors`.
- **T8. AuthZ.** Apply the same RBAC the resource List/Get uses
  (`alertrule.Authorize` / `recordingrule.Authorize`), scoped per folder, inside the handler.

### Phase 3 — Unified backend

- **T9. Document builders.** Add AlertRule + RecordingRule builders under
  `pkg/storage/unified/search/builders/`, declaring the searchable/filterable columns: title,
  folder, group, paused, per-kind columns, a multi-valued **source datasource UID** column (derived
  from `expressions[*].datasourceUID`, excluding `__expr__`), a multi-valued **rule labels** column,
  and a boolean/derived **plugin-owned** column (presence of `__grafana_origin`).
- **T10. Register builders** with the unified search index.
- **T11. Unified search request.** Build/issue `ResourceSearchRequest` (federated for the cross-kind
  route); parse results into the DTOs (mirror `dashboardsearch.ParseResults`).

### Phase 4 — Tests & docs

- **T12. Tests.** Unit tests for param parsing and both backends; integration tests under
  `pkg/tests/apis/alerting/rules/{alertrule,recordingrule}`; parity tests vs the old Prometheus
  endpoint behavior for the config filters.
- **T13. OpenAPI/docs.** Run `make swagger-gen`; verify the routes appear in swagger.

---

## Considerations & risks

- **Cross-kind result shape & pagination.** The cross-kind endpoint returns heterogeneous hits; keep
  `RuleHit` uniform with a `type` discriminator and kind-specific extras on `Field`, so clients
  don't need two parsers. **Decision: cross-kind results interleave** (single ordered page across
  both kinds), not grouped by kind — so ordering/score must be comparable across kinds and the
  continuation token must encode a position in the merged stream. In unified mode this is the
  federated-search ordering; in legacy mode `ListAlertRules` already returns both kinds in one
  ordered set.
- **Pagination model.** The old endpoint is group-paginated; the K8s endpoints are folder-paginated.
  Pick one continuation model and keep it consistent across all three routes. Legacy SQL search uses
  page-based pagination; unified uses offset/continueToken — the handler must fill the right field
  per backend (dashboards fill both).
- **Rule labels are template strings.** Indexing `spec.labels` matches the literal configured value
  (`severity: "{{ $labels.severity }}"`), **not** the evaluated label. Confirm the UI's `label:`
  filter semantics expect configured-label matching.
- **Substring search semantics.** Replicating `search.rule_name` / `search.folder` /
  `search.rule_group` needs free-text/ngram indexing in unified mode and `LIKE` in legacy mode —
  confirm case-insensitivity and folder _path_ (not just name) behavior.
- **Dual-write drift.** During the legacy→unified migration the two backends must return equivalent
  results; parity tests are essential.
- **App-sdk handler ergonomics.** Custom-route handlers receive `app.CustomRouteRequest` and write
  via `app.CustomRouteResponseWriter`, not a raw `http.ResponseWriter`. Confirm raw query-param
  access, requester identity, and proper `apierrors` rendering early (de-risk in T7).
- **Separate FE/BE PRs** per repo convention; this plan is backend-only. Frontend rule-list
  migration to the new endpoint is a follow-up.

---

## Deferred work

- **State & health filtering/sorting.** Runtime data from the alerting engine, not on the resource.
  Requires merging from the Prometheus/state API (`RouteGetRuleStatuses` /
  `PrepareRuleGroupStatusesV2` in
  [pkg/services/ngalert/api/prometheus/api_prometheus.go](../../../pkg/services/ngalert/api/prometheus/api_prometheus.go))
  and raises pagination-correctness questions (filtering/sorting on a field the index/SQL can't
  paginate on). Tracked separately; design once the config-level search has landed.

---

## Resolved decisions

- **Cross-kind pagination:** interleave both kinds in one ordered page (not grouped by kind).
- **`plugins`:** determined by presence of `spec.labels["__grafana_origin"]`; config-derivable and
  indexable, no runtime lookup.
- **Folder:** exact UID for v1; folder path/name substring search deferred.
- **Source datasource:** `datasourceUID` filters on the set of `spec.expressions[*].datasourceUID`
  (both kinds), separate from RecordingRule's `targetDatasourceUID`.
- **Sorting:** default is title/relevance; sorting by group is opt-in (`sort=group`), using the
  compound key `(folder, group name, group-index, title)`.

## Open questions for the team

_None outstanding for the config-level scope. State/health remain deferred (see
[Deferred work](#deferred-work))._
</content>
