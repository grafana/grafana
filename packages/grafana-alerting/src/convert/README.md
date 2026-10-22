# `@grafana/alerting/convert`

Code for Grafana's Prometheus convert API (`/api/convert/...`). That API takes rule groups and Alertmanager
configs in the format mimirtool and cortextool use, and turns them into Grafana-managed alert rules,
recording rules and notification resources.

This entry point holds functions, types and an RTKQ client. It has no React components: those belong in
`@grafana/alerting/unstable`.

```ts
import { convertAPI, getConvertRulesHeaders, type RulerRuleGroupDTO } from '@grafana/alerting/convert';
```

## What's in here

| File                      | What it holds                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `api/types.ts`            | The rule group types, plus the request and response bodies of the convert API                   |
| `api/headers.ts`          | Builds the `X-Grafana-Alerting-*` headers the convert API reads its options from                |
| `api/client.ts`           | `convertAPI`, the RTKQ client for the convert API                                               |
| `notificationSettings.ts` | Converts between the notification settings selector's value and the shape the convert API takes |

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
  each rule in Grafana's ruler API.
- `ConvertPrometheusResponse` and `ConvertAlertmanagerResponse`: what the endpoints answer with.
  `ConvertAlertmanagerResponse` also lists what an Alertmanager import renamed and added.
- `AlertmanagerUserConfig`: an Alertmanager config the way mimirtool sends it, as a YAML string plus template
  files.

### Headers (`api/headers.ts`)

The convert API reads its options from headers instead of the request body. These functions turn an options
object into those headers, leaving out anything that isn't set:

- `getConvertRulesHeaders(options)` for rule imports: data source, target data source, folder, paused
  state, notification settings, extra labels, version message and provenance.
- `getConvertRulesFolderHeaders(options)` for reading and deleting rules in a folder.
- `getConvertAlertmanagerHeaders(options)` for Alertmanager imports: identifier, force replace, dry run
  and promote.

They're exported for apps that call the API with their own fetch helpers instead of `convertAPI`.

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
- The import endpoints take the selector's `NotificationSettings` value and convert it for the header
  themselves.
- Reads only return rules and configs that came in through the convert API, not every rule in a folder.
- Like the other clients in this package, it needs its reducer and middleware added to a Redux store.

### Notification settings (`notificationSettings.ts`)

- `toRulerNotificationSettings(value)` turns the selector's value into a `RulerNotificationSettingsDTO` for the
  header. `null` (default routing) gives `undefined`, meaning "leave the header out".
- `fromRulerNotificationSettings(settings)` reads one back, e.g. from a rule's `notification_settings`.

Both leave out blank durations and empty lists, because the API rejects an empty duration.

`NotificationSettings` is declared here for now. It's a copy of the type from grafana/grafana#134990; once
that's merged, import it from there instead and remove the copy.

## What doesn't belong here

- React components. Put those in `@grafana/alerting/unstable`.
- Grafana-managed types that have nothing to do with the convert API. These live with the rest of the
  package, built on the generated k8s API clients.
