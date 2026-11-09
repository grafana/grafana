# `@grafana/alerting/convert`

Code for Grafana's Prometheus convert API (`/api/convert/...`). That API takes rule groups and Alertmanager
configs in the format mimirtool and cortextool use, and turns them into Grafana-managed alert rules,
recording rules and notification resources.

This entry point holds functions, types and an RTKQ client. It has no React components, and none should be
added: apps build their own forms from these and from the components `@grafana/alerting/unstable` already has.

```ts
import { convertAPI, type NotificationSettings, type RulerRuleGroupDTO } from '@grafana/alerting/convert';
```

## What's in here

| File                      | What it holds                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `api/types.ts`            | The rule group types, plus the request and response bodies of the convert API                 |
| `api/headers.ts`          | Builds the `X-Grafana-Alerting-*` headers the convert API reads its options from              |
| `api/client.ts`           | `convertAPI`, the RTKQ client for the convert API                                             |
| `notificationSettings.ts` | The `NotificationSettings` value, and conversions to and from the shape the convert API takes |

### Types (`api/types.ts`)

These are plain types: they describe the JSON the convert API sends and receives, and nothing checks a
response against them when it arrives. The prometheus-alerting plugin keeps its own zod schemas for the same
rule shapes.

- **Rule groups**, as the Ruler API reads and writes them: `RulerRuleGroupDTO`, `RulerRuleDTO`,
  `RulerAlertingRuleDTO`, `RulerRecordingRuleDTO`, and `RulerRulesConfigDTO` (groups keyed by namespace).
  The convert API drops the Mimir-only group fields (`source_tenants`, `evaluation_delay`,
  `align_evaluation_time_on_interval`) without an error, so a federated Mimir group comes in as a plain one.
- `RulerNotificationSettingsDTO`: notification settings in snake case (`receiver`, `group_by`, `policy`, ...).
  It's the format of the `X-Grafana-Alerting-Notification-Settings` header, and of `notification_settings` on
  each rule in Grafana's ruler API. It's either a `RulerContactPointRoutingDTO` (a `receiver` with optional
  overrides) or a `RulerPolicyRoutingDTO` (a `policy`), never both. Grafana's ruler API sends `receiver: ''`
  next to a policy, which the policy type allows.
- `ConvertPrometheusResponse` and `ConvertAlertmanagerResponse`: what the endpoints answer with.
  `ConvertAlertmanagerResponse` also lists what an Alertmanager import renamed (`RenameResources`) and added
  (`MergeStats`).
- `AlertmanagerUserConfig`: an Alertmanager config the way mimirtool sends it, as a YAML string plus template
  files.

### Headers (`api/headers.ts`)

The convert API reads its options from headers instead of the request body. `convertAPI`'s endpoints take
the options as plain fields and turn them into those headers, leaving out anything that isn't set:

- Rule imports: data source, target data source, folder, paused state, notification settings, extra labels,
  version message and provenance.
- Reading and deleting rules: the folder.
- Alertmanager imports: identifier, force replace, dry run and promote.

Neither the functions that build the headers nor the option types are exported. Call the API through
`convertAPI`. When you need an endpoint's argument type by name, take it from the endpoint:

```ts
type PostRuleGroupsArgs = typeof convertAPI.endpoints.postRuleGroups.Types.QueryArg;
```

### RTKQ client (`api/client.ts`)

`convertAPI` covers the mimirtool paths. Grafana serves the same endpoints under `/api/convert/api/prom/rules`
for cortextool, so those aren't repeated here.

| Endpoint                    | Method and path                                          |
| --------------------------- | -------------------------------------------------------- |
| `getRules`                  | `GET /prometheus/config/v1/rules`                        |
| `getNamespace`              | `GET /prometheus/config/v1/rules/{namespace}`            |
| `getRuleGroup`              | `GET /prometheus/config/v1/rules/{namespace}/{group}`    |
| `postRuleGroups`            | `POST /prometheus/config/v1/rules`                       |
| `postRuleGroup`             | `POST /prometheus/config/v1/rules/{namespace}`           |
| `deleteNamespace`           | `DELETE /prometheus/config/v1/rules/{namespace}`         |
| `deleteRuleGroup`           | `DELETE /prometheus/config/v1/rules/{namespace}/{group}` |
| `getAlertmanagerConfig`     | `GET /api/v1/alerts`                                     |
| `postAlertmanagerConfig`    | `POST /api/v1/alerts`                                    |
| `deleteAlertmanagerConfig`  | `DELETE /api/v1/alerts`                                  |
| `promoteAlertmanagerConfig` | `POST /api/v1/alerts/{identifier}/promote`               |

All paths are under `/api/convert`. A few things to know:

- The read endpoints ask for JSON. Without that, Grafana answers in YAML so mimirtool keeps working.
- The import endpoints take a `NotificationSettings` value and convert it for the header themselves.
- Reads only return rules and configs that came in through the convert API, not every rule in a folder.
- Options travel as HTTP headers and Grafana doesn't decode them yet, so keep text values (`versionMessage`,
  `extraLabels`) to ASCII. `BackendSrv` percent-encodes a value with a character outside Latin-1, spaces included, and
  Grafana stores it that way (`a — b` becomes `a%20%E2%80%94%20b`). Latin-1 characters like `é` go out as a single byte
  that isn't valid UTF-8. An `identifier` must be a lowercase RFC 1123 subdomain, or Grafana answers with a 400.
- It only invalidates its own cache tags. Importing or deleting an Alertmanager config adds or removes contact points,
  notification policies, time intervals and templates, and promoting it makes them editable by clearing their
  `converted_prometheus` provenance. An app that caches those through another client has to refetch them itself after
  those mutations. A dry run changes nothing.
- Like the other clients in this package, it needs its reducer and middleware in a Redux store. Pass it to
  `createAlertingStore` from `@grafana/alerting/unstable` to get one store for it and the existing pickers:
  `createAlertingStore([convertAPI])`.

### Notification settings (`notificationSettings.ts`)

`NotificationSettings` is where an alert rule's notifications go: `{ type: 'SimplifiedRouting', receiver, ... }`
for a contact point, optionally with grouping, timing and time interval overrides, or
`{ type: 'NamedRoutingTree', routingTree }` for a named notification policy tree. `null` means the default
policy tree. Apps build this value from their own form.

- `toRulerNotificationSettings(value)` turns it into a `RulerNotificationSettingsDTO` for the
  header. `null` (default routing) gives `undefined`, meaning "leave the header out".
- `fromRulerNotificationSettings(settings)` reads one back, e.g. from a rule's `notification_settings`.

Both leave out blank durations and empty lists, because the API rejects an empty duration.

A contact point needs a non-empty `receiver`. Neither function checks it, and the import endpoints reject settings
with neither a receiver nor a policy, so the app's form should require it.

## What doesn't belong here

- React components, in this entry point or anywhere else in the package.
- Grafana-managed types that have nothing to do with the convert API. These live with the rest of the
  package, built on the generated k8s API clients.
