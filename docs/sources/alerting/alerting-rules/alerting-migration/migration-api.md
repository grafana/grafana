---
description: Use the Grafana Alerting API import tool to convert your datasource managed alert rules into Grafana managed alert rules
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Import data source-managed alert rules with Grafana Mimirtool
menuTitle: API alert rules import
weight: 601
refs:
  configure-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
---

# Import data source-managed alert rules with Grafana Mimirtool

You can convert data source-managed alert rules to Grafana-managed alert rules with the Grafana import tool in the Grafana user interface, or you can convert them with the Grafana Mimirtool command-line tool. This guide tells you how to use Mimirtool to import your data source-managed alert rules.

## Before you begin

To import data source-managed alert rules with Grafana Mimirtool, you need to have the Grafana Mimirtool command-line tool installed.

You need a service account the following [RBAC permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/):

- Alerting: Rules Reader
- Alerting: Rules Writer
- Alerting: Set provisioning status
- Datasources: Reader
- Folders: Creator
- Folders: Reader
- Folders: Writer

You also need to create a service account token with your service account. Refer to the [documentation for more information on service accounts and service account tokens](/docs/grafana/latest/administration/service-accounts/)

## How it works

When data source-managed alert rules are converted to Grafana-managed alert rules, the following are applied to the Grafana-managed alert rules:

- All rules are given `rule_query_offset` offset value of 1m.  
  Grafana OSS and Enterprise can configure this value in their conf:
  ```
  [unified_alerting.prometheus_conversion]
  rule_query_offset = 1m
  ```
  If this value is set explicitly in a rule group, that value takes precedence over the configuration setting.
- The `missing_series_evals_to_resolve` is set to 1 for the new rules.
- The newly created rules are given unique UIDs.  
  If you don't want the UID to be automatically generated, you can specify a specific UID with the `__grafana_alert_rule_uid__` label.

## Import alert rules with Mimirtool or cortextool

You can use either [Mimirtool](/docs/mimir/latest/manage/tools/mimirtool/) or [`cortextool`](https://github.com/grafana/cortex-tools) (version `0.11.3` or later) to import your alert rules. For more information about Mimirtool commands, see the [Mimirtool documentation](/docs/mimir/latest/manage/tools/mimirtool/#rules).

To convert your alert rules, use the following command prompt substituting the your URL and your service account token as indicated, followed by your intended Mimirtool command.

```bash
MIMIR_ADDRESS=https://<Grafana URL>.grafana-dev.net/api/convert/ MIMIR_AUTH_TOKEN=<your token ID> MIMIR_TENANT_ID=1
```

For cortextool, you need to set `--backend=loki` to import Loki alert rules. For example:

```bash
CORTEX_ADDRESS=<grafana url>/api/convert/ CORTEX_AUTH_TOKEN=<your token> CORTEX_TENANT_ID=1 cortextool rules --backend=loki list
```

Headers can be passed to the `mimirtool` or `cortextool` via `--extra-headers`.

For more information about the Rule API points and examples of Mimirtool commands, see the [Mimir HTTP API documentation](/docs/mimir/latest/references/http-api/#ruler-rules:~:text=config/v1/rules-,Get%20rule%20groups%20by%20namespace,DELETE%20%3Cprometheus%2Dhttp%2Dprefix%3E/config/v1/rules/%7Bnamespace%7D,-Delete%20tenant%20configuration) for more information about the Rule API points and examples of Mimirtool commands.

{{< admonition type="note" >}}
To use the `mimirtool rules sync` command, you need to set the `--concurrency` parameter to `1` (`--concurrency=1`). The parameter defaults to 8, which may cause the API to return errors.
{{< /admonition >}}

### Compatible endpoints

The following are compatible API endpoints:

**GET**

```
GET /convert/prometheus/config/v1/rules - Get all rule groups across all namespaces
GET /convert/prometheus/config/v1/rules/<NamespaceTitle> - Get rule groups in a specific namespace
GET /convert/prometheus/config/v1/rules/<NamespaceTitle>/<Group> - Get a single rule group

```

**POST**

```
POST /convert/prometheus/config/v1/rules - Create/update multiple rule groups across multiple namespaces
POST /convert/prometheus/config/v1/rules/<NamespaceTitle> - Create/update a single rule group in a namespace
```

When posting rules, the following header is required:
`X-Grafana-Alerting-Datasource-UID` - Supply the UID of the data source to use for queries.

**Delete**

```
DELETE /convert/prometheus/config/v1/rules/{NamespaceTitle} - Delete all alert rules in a namespace
DELETE /convert/prometheus/config/v1/rules/{NamespaceTitle}/{Group} - Delete a specific rule group
```

**Optional Headers**

Additional configuration headers for more granular import control include the following:

- `X-Grafana-Alerting-Recording-Rules-Paused` - Set to "true" to import recording rules in paused state.
- `X-Grafana-Alerting-Alert-Rules-Paused` - Set to "true" to import alert rules in paused state.
- `X-Grafana-Alerting-Target-Datasource-UID` - The UID of the target data source for recording rules. If not specified, the value from `X-Grafana-Alerting-Datasource-UID` is used.
- `X-Grafana-Alerting-Folder-UID` - Enter the UID of the target destination folder for imported rules.
- `X-Disable-Provenance` - When present, imported rules won't be marked as provisioned, which allows for them to be edited in the UI. Note that rules imported with this header won't be visible in the GET endpoints of this API, as these endpoints only return rules that are provisioned and were specifically imported via this API.
- `X-Grafana-Alerting-Notification-Settings` – JSON-encoded `AlertRuleNotificationSettings` object that allows setting the contact point for the alert rules.

#### AlertRuleNotificationSettings object

When you set `X-Grafana-Alerting-Notification-Settings`, the header value must be a JSON-encoded object with the following keys:

| Field                   | Type       | Required | Example                                    | Description                                                                                             |
| ----------------------- | ---------- | -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `receiver`              | `string`   | Yes      | `"grafana-default-email"`                  | Name of the contact point (receiver) to which alerts are routed. Must exist in Grafana before import.   |
| `group_by`              | `[]string` | No       | `["alertname","grafana_folder","cluster"]` | Label set used by Alertmanager to aggregate alerts into a single notification.                          |
| `group_wait`            | `duration` | No       | `"30s"`                                    | How long Alertmanager waits before sending the first notification for a new group.                      |
| `group_interval`        | `duration` | No       | `"5m"`                                     | Time to wait before adding new alerts to an existing group's next notification.                         |
| `repeat_interval`       | `duration` | No       | `"4h"`                                     | Minimum time before a previously-sent notification is repeated. Must not be less than `group_interval`. |
| `mute_time_intervals`   | `[]string` | No       | `["maintenance"]`                          | One or more mute time interval names that silence alerts during those windows.                          |
| `active_time_intervals` | `[]string` | No       | `["maintenance"]`                          | List of active time interval names. Alerts are suppressed unless the current time matches one of them.  |
