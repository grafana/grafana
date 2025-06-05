---
canonical: https://grafana.com/docs/grafana/latest/alerting-rules/alerting-migration/migration-api/
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
  ui-import-tool:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/alerting-migration/
  configure-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
---

# Import data source-managed alert rules with Grafana Mimirtool

You can convert data source–managed alert rules, such as Prometheus alert rules, to Grafana-managed alert rules using [Grafana user interface](ref:ui-import-tool) or command-line tools. This guide shows you how to use the Grafana Mimirtool to import your data source-managed alert rules.

## Before you begin

You need to have the [Grafana Mimirtool](/docs/mimir/latest/manage/tools/mimirtool/) command-line tool installed.

You need a service account with the following [RBAC permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/):

- Alerting: Rules Reader
- Alerting: Rules Writer
- Alerting: Set provisioning status
- Datasources: Reader
- Folders: Creator
- Folders: Reader
- Folders: Writer

You also need to create a service account token with your service account. Refer to the [documentation for more information on service accounts and service account tokens](/docs/grafana/latest/administration/service-accounts/).

## How it works

When you use the import tool, data source-managed rules are copied to another folder as Grafana-managed alert rules, preserving the behavior of the rules, and the original alert rules are kept in their original location.

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

## Import alert rules with mimirtool or cortextool

You can use either [`mimirtool`](/docs/mimir/latest/manage/tools/mimirtool/) or [`cortextool`](https://github.com/grafana/cortex-tools) (version `0.11.3` or later) to import data source–managed alert rules into Grafana as Grafana-managed alert rules.

### mimirtool

To convert and import them into a Grafana instance, you can use the `mimirtool rules load` command:

```bash
MIMIR_ADDRESS=<GRAFANA_BASE_URL>/api/convert/ \
MIMIR_AUTH_TOKEN=<SERVICE_ACCOUNT_TOKEN> \
MIMIR_TENANT_ID=1 \
mimirtool rules load rule_file.yaml \
  --extra-headers "X-Grafana-Alerting-Datasource-UID=<DATASOURCE_UID_QUERY_TARGET>"
```

This command imports Prometheus alert rules defined in `rule_file.yaml` as Grafana-managed alert rules. It's important to know that:

1. When using the `<GRAFANA_BASE_URL>/api/convert/` endpoint, `mimirtool` interacts with Grafana—not with a Mimir instance. In this case, `MIMIR_TENANT_ID` must always be set to `1`.
1. The [`X-Grafana-Alerting-Datasource-UID` header](#x-grafana-alerting-datasource-uid) configures the data source that the imported alert rules will query. Use multiple `--extra-headers` flags to include other [optional headers](#optional-headers).

Similarly, the `rules sync` command can import and update Grafana-managed alert rules.

```bash
MIMIR_ADDRESS=<GRAFANA_BASE_URL>/api/convert/ \
MIMIR_AUTH_TOKEN=<SERVICE_ACCOUNT_TOKEN> \
MIMIR_TENANT_ID=1 \
mimirtool rules sync rule_file.yaml \
  --extra-headers "X-Grafana-Alerting-Datasource-UID=<DATASOURCE_UID_QUERY_TARGET>" \
  --concurrency 1
```

The `--concurrency` flag must be set to `1`, as the default value of `8` may cause API errors.

This `sync` command reads rules from the file, compares them with the existing Grafana-managed rules in the instance, and applies only the differences—creating, updating, or deleting rules as needed.

```output
## Sync Summary: 0 Groups Created, 1 Groups Updated, 0 Groups Deleted
```

For more information other Mimirtool commands and options, see the [Mimirtool documentation](/docs/mimir/latest/manage/tools/mimirtool/#rules) and the [Mimir HTTP Rule API documentation](/docs/mimir/latest/references/http-api/#ruler-rules:~:text=config/v1/rules-,Get%20rule%20groups%20by%20namespace,DELETE%20%3Cprometheus%2Dhttp%2Dprefix%3E/config/v1/rules/%7Bnamespace%7D,-Delete%20tenant%20configuration).

### cortextool

For Loki alert rules, use [`cortextool`](https://github.com/grafana/cortex-tools) (version `0.11.3` or later) with the `--backend=loki` flag. For example:

```bash
CORTEX_ADDRESS=<GRAFANA_BASE_URL>/api/convert/ \
CORTEX_AUTH_TOKEN=<SERVICE_ACCOUNT_TOKEN> \
CORTEX_TENANT_ID=1 \
cortextool rules load loki_rules.yaml \
  --extra-headers "X-Grafana-Alerting-Datasource-UID=<LOKI_DATASOURCE_UID_QUERY_TARGET>" \
  --backend=loki
```

### Compatible endpoints

The API endpoints listed in this section are supported in Grafana and are used by mimirtool and cortextool, as shown earlier.

The `POST` endpoints can be used to import data source–managed alert rules.

| Endpoint | Method                                              | Summary                                                                                                                                               |
| -------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST     | /convert/prometheus/config/v1/rules                 | Create or update multiple rule groups across multiple namespaces. Requires [`X-Grafana-Alerting-Datasource-UID`](#x-grafana-alerting-datasource-uid). |
| POST     | /convert/prometheus/config/v1/rules/:namespaceTitle | Create or update a single rule group in a namespace. Requires [`X-Grafana-Alerting-Datasource-UID`](#x-grafana-alerting-datasource-uid).              |

The `GET` and `DELETE` endpoints work only with provisioned and imported alert rules.

| Endpoint | Method                                                     | Summary                                             |
| -------- | ---------------------------------------------------------- | --------------------------------------------------- |
| GET      | /convert/prometheus/config/v1/rules                        | Get all imported rule groups across all namespaces. |
| GET      | /convert/prometheus/config/v1/rules/:namespaceTitle        | Get imported rule groups in a specific namespace.   |
| DELETE   | /convert/prometheus/config/v1/rules/:namespaceTitle        | Delete all imported alert rules in a namespace.     |
| DELETE   | /convert/prometheus/config/v1/rules/:namespaceTitle/:group | Delete a specific imported rule group.              |

### Optional Headers

Additional configuration headers for more granular import control include the following:

#### `X-Disable-Provenance`

When this header is set to `true`:

- The imported rules are not marked as provisioned.
- They can then be edited in the Grafana UI.
- They are excluded from the `GET` and `DELETE` operations on the `/api/convert` endpoints.

#### `X-Grafana-Alerting-Alert-Rules-Paused`

Set to "true" to import alert rules in paused state.

#### `X-Grafana-Alerting-Recording-Rules-Paused`

Set to "true" to import recording rules in paused state.

#### `X-Grafana-Alerting-Datasource-UID`

The UID of the data source to use for alert rule queries.

#### `X-Grafana-Alerting-Target-Datasource-UID`

The UID of the target data source for recording rules. If not specified, the value from `X-Grafana-Alerting-Datasource-UID` is used.

#### `X-Grafana-Alerting-Folder-UID`

Enter the UID of the target destination folder for imported rules.

#### `X-Grafana-Alerting-Notification-Settings`

JSON-encoded [`AlertRuleNotificationSettings` object](#alertrulenotificationsettings-object) that allows setting the contact point for the alert rules.

##### AlertRuleNotificationSettings object

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
