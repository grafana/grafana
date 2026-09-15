---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/convert-api/
description: Reference for the endpoints and headers of the Grafana Alerting convert API, which imports Prometheus-style alert rules and Alertmanager notification configuration into Grafana.
keywords:
  - grafana
  - alerting
  - api
  - convert
  - import
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Convert API
menuTitle: Convert API
weight: 220
refs:
  import-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/alerting-migration/
  import-alertmanager-configuration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/import-alertmanager-configuration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/import-alertmanager-configuration/
  configure-feature-toggles:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/
---

# Convert API

The convert API imports Prometheus-style alert rules and Alertmanager notification configuration into Grafana. Grafana serves it under `/api/convert/`, and the following tools use it:

- `mimirtool` and `cortextool`, when you [import data source-managed rules to Grafana-managed rules](ref:import-rules).
- The Grafana Alerting import wizard, when you [import Alertmanager configuration to Grafana](ref:import-alertmanager-configuration).

This page lists the endpoints and headers. For the import procedures, refer to those two pages.

## Rule endpoints

The rule endpoints are compatible with the [Mimir HTTP API](/docs/mimir/latest/references/http-api/) and are the endpoints that `mimirtool` and `cortextool` call.

In these endpoints, a "namespace" corresponds to a folder title in Grafana.

The `POST` endpoints can be used to import data source–managed alert rules. They accept requests in both YAML and JSON. If no media type is specified, YAML is assumed.

| Endpoint | Method                                                | Summary                                                                                                                                                                                         | Mimir equivalent                                                         |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| POST     | `/convert/prometheus/config/v1/rules`                 | [Create or update multiple rule groups](#create-or-update-multiple-rule-groups) across multiple namespaces. Requires [`X-Grafana-Alerting-Datasource-UID`](#x-grafana-alerting-datasource-uid). | None                                                                     |
| POST     | `/convert/prometheus/config/v1/rules/:namespaceTitle` | Create or update a single rule group in a namespace. Requires [`X-Grafana-Alerting-Datasource-UID`](#x-grafana-alerting-datasource-uid).                                                        | [Set rule group](/docs/mimir/latest/references/http-api/#set-rule-group) |

The `GET` and `DELETE` endpoints work only with provisioned and imported alert rules. All `GET` endpoints support both JSON and YAML response formats based on the `Accept` header: use `application/json` for JSON responses, or `application/yaml` for YAML responses. YAML is the default format when no `Accept` header is specified.

| Endpoint | Method                                                       | Summary                                             | Mimir equivalent                                                                                     |
| -------- | ------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET      | `/convert/prometheus/config/v1/rules`                        | Get all imported rule groups across all namespaces. | [List rule groups](/docs/mimir/latest/references/http-api/#list-rule-groups)                         |
| GET      | `/convert/prometheus/config/v1/rules/:namespaceTitle`        | Get imported rule groups in a specific namespace.   | [Get rule groups by namespace](/docs/mimir/latest/references/http-api/#get-rule-groups-by-namespace) |
| GET      | `/convert/prometheus/config/v1/rules/:namespaceTitle/:group` | Get imported rule group in a specific namespace.    | [Get rule group](/docs/mimir/latest/references/http-api/#get-rule-group)                             |
| DELETE   | `/convert/prometheus/config/v1/rules/:namespaceTitle`        | Delete all imported alert rules in a namespace.     | [Delete namespace](/docs/mimir/latest/references/http-api/#delete-namespace)                         |
| DELETE   | `/convert/prometheus/config/v1/rules/:namespaceTitle/:group` | Delete a specific imported rule group.              | [Delete rule group](/docs/mimir/latest/references/http-api/#delete-rule-group)                       |

### Create or update multiple rule groups

```
POST /convert/prometheus/config/v1/rules
```

Creates or updates multiple rule groups across multiple namespaces. This endpoint expects a request with a map of namespace titles to arrays of rule groups, and returns `202` on success.

This endpoint has no Mimir equivalent and is Grafana-specific for bulk operations.

#### Example request body

```yaml
namespace1:
  - name: MyGroupName1
    rules:
      - alert: MyAlertName1
        expr: up == 0
        labels:
          severity: warning
namespace2:
  - name: MyGroupName2
    rules:
      - alert: MyAlertName2
        expr: rate(http_requests_total[5m]) > 0.1
        labels:
          severity: critical
```

## Rule import headers

Additional configuration headers for more granular import control include the following:

### `X-Disable-Provenance`

When this header is set to `true`:

- The imported rules are not marked as provisioned.
- They can then be edited in the Grafana UI.
- They are excluded from the `GET` and `DELETE` operations on the [rule endpoints](#rule-endpoints).

Do not enable this header when using the `rules sync` command, as it relies on the `GET` and `DELETE` operations to detect and update existing rules.

### `X-Grafana-Alerting-Alert-Rules-Paused`

Set to `true` to import alert rules in paused state.

### `X-Grafana-Alerting-Recording-Rules-Paused`

Set to `true` to import recording rules in paused state.

### `X-Grafana-Alerting-Datasource-UID`

The UID of the data source to use for alert rule queries.

If not specified in the header, Grafana uses the configured default from `unified_alerting.prometheus_conversion.default_datasource_uid`. If neither the header nor the configuration option is provided, the request fails.

### `X-Grafana-Alerting-Target-Datasource-UID`

The UID of the target data source for recording rules. If not specified, the value from `X-Grafana-Alerting-Datasource-UID` is used.

### `X-Grafana-Alerting-Folder-UID`

Enter the UID of the target destination folder for imported rules.

### `X-Grafana-Alerting-Notification-Settings`

JSON-encoded [`AlertRuleNotificationSettings` object](#alertrulenotificationsettings-object) that allows setting the contact point for the alert rules.

{{< collapse title="AlertRuleNotificationSettings object" >}}

#### AlertRuleNotificationSettings object

When you set `X-Grafana-Alerting-Notification-Settings`, the header value must be a JSON-encoded object with the following keys:

| Field                   | Type       | Required | Example                                    | Description                                                                                             |
| ----------------------- | ---------- | -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `receiver`              | `string`   | Yes      | `"grafana-default"`                        | Name of the contact point (receiver) to which alerts are routed. Must exist in Grafana before import.   |
| `group_by`              | `[]string` | No       | `["alertname","grafana_folder","cluster"]` | Label set used by Alertmanager to aggregate alerts into a single notification.                          |
| `group_wait`            | `duration` | No       | `"30s"`                                    | How long Alertmanager waits before sending the first notification for a new group.                      |
| `group_interval`        | `duration` | No       | `"5m"`                                     | Time to wait before adding new alerts to an existing group's next notification.                         |
| `repeat_interval`       | `duration` | No       | `"4h"`                                     | Minimum time before a previously-sent notification is repeated. Must not be less than `group_interval`. |
| `mute_time_intervals`   | `[]string` | No       | `["maintenance"]`                          | One or more mute time interval names that silence alerts during those windows.                          |
| `active_time_intervals` | `[]string` | No       | `["maintenance"]`                          | List of active time interval names. Alerts are suppressed unless the current time matches one of them.  |

{{< /collapse >}}

## Alertmanager configuration endpoints

The following endpoints back the import wizard and the **Import** tab. They're in public preview and are available when the `alertingImportAlertmanagerAPI` feature toggle is enabled. For more details, refer to [configure feature toggles](ref:configure-feature-toggles).

| Method | Endpoint                                          | Summary                                                      |
| ------ | ------------------------------------------------- | ------------------------------------------------------------ |
| POST   | `/api/convert/api/v1/alerts`                      | Stage an Alertmanager configuration, or promote it directly. |
| GET    | `/api/convert/api/v1/alerts`                      | Get the staged Alertmanager configuration.                   |
| DELETE | `/api/convert/api/v1/alerts`                      | Revert the staged Alertmanager configuration.                |
| POST   | `/api/convert/api/v1/alerts/{IDENTIFIER}/promote` | Merge an already-staged configuration into the live one.     |

The `POST` and `DELETE` endpoints take the identifier in a header rather than the path. The request body holds the Alertmanager configuration and its templates:

```json
{
  "alertmanager_config": "<ALERTMANAGER_CONFIG_YAML>",
  "template_files": {
    "<TEMPLATE_FILE_NAME>": "<TEMPLATE_CONTENT>"
  }
}
```

Replace the following placeholders:

- _`<ALERTMANAGER_CONFIG_YAML>`_: your Alertmanager configuration, as a YAML string.
- _`<TEMPLATE_FILE_NAME>`_: the name of a template file. This becomes the template name in Grafana.
- _`<TEMPLATE_CONTENT>`_: the contents of that template file.

## Alertmanager configuration headers

| Header                                    | Description                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `X-Grafana-Alerting-Config-Identifier`    | Names the staged configuration and the policy tree it produces. Defaults to `imported`.                              |
| `X-Grafana-Alerting-Config-Force-Replace` | Set to `true` to replace a staged configuration that has a different identifier.                                     |
| `X-Grafana-Alerting-Dry-Run`              | Set to `true` to validate the configuration and report conflicts and renames without saving it.                      |
| `X-Grafana-Alerting-Promote`              | Set to `true` to merge the configuration into the live one instead of only staging it. This is a one-time operation. |
