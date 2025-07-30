---
aliases:
  - ../alerting-rules/alerting-migration/migration-api/ # /docs/grafana/<GRAFANA_VERSION>/alerting-rules/alerting-migration/migration-api/
canonical: https://grafana.com/docs/grafana/latest/alerting-rules/alerting-migration/
description: Convert alert rules from data sources such as Mimir, Loki, and Prometheus into Grafana-managed alert rules. This enables you to operate and manage these rules using Grafana Alerting.
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Import data source-managed rules to Grafana-managed rules
menuTitle: Import to Grafana-managed rules
weight: 300
refs:
  configure-grafana-rule_query_offset:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#rule_query_offset
  evaluation-strategies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/
  missing_series_evaluations_to_resolve:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/stale-alert-instances/#configure-missing-series-evaluations-to-resolve
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/stale-alert-instances/#configure-missing-series-evaluations-to-resolve
  configure-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
---

# Import data source-managed rules to Grafana-managed rules

You can convert existing alert rules from data sources such as Mimir, Loki, and Prometheus into Grafana-managed alert rules. This enables you to operate and manage these rules using Grafana Alerting.

This guide explains two methods for importing data source-managed rules:

- Using the [Grafana Alerting user interface](#import-rules-with-grafana-alerting) to import rules from connected data sources or Prometheus rule YAML files.

- Using [command-line tools](#import-rules-with-command-line-tools) like `mimirtool` and `cortextool` to import rules from YAML files.

Importing rules is a safe operation: the original data source–managed rules remain intact in their original location. During import, the rules are converted into Grafana-managed rules while preserving their configuration and behavior.

Choose the method that best fits your workflow. As a best practice, test and validate your import process before migrating all alert rules.

## How it works

When you use any of the import methods, data source–managed rules are copied to another folder as Grafana-managed rules.

The original data source–managed rules remain intact in their original location.

The copied rules are converted to Grafana-managed rules, preserving their behavior by using equivalent Grafana-managed features. The following settings are applied during the conversion:

- **Unique UIDs**

  The newly created rules are assigned unique UIDs.
  If you don’t want a UID to be auto-generated, you can specify one using the `__grafana_alert_rule_uid__` label.

- **Query offset**

  A query offset is applied to each rule. For example, an offset of `1m` adjusts the query's time range to `To: now-1m`.

  The rule query offset is taken from the `query_offset` value in the rule group configuration. If empty, it defaults to the [`rule_query_offset` configuration setting](ref:configure-grafana-rule_query_offset), which is `1m` by default.

- **Missing series evaluations to resolve**

  The [Missing series evaluations to resolve](ref:missing_series_evaluations_to_resolve) setting is set to `1` to replicate Prometheus’s alert eviction behavior.

- **Rule group labels**

  Labels defined at the rule group level are added as labels to each imported rule within the group.

- **Sequential evaluation**

  Imported rules are evaluated sequentially within each rule group, mirroring Prometheus behavior. This differs from native Grafana-managed alert rules, where the evaluation order is not enforced. For more details, refer to [evaluation strategies](ref:evaluation-strategies).

- **Feature compatibility**

  The rule group `limit` option and the `query` function within alert rule templates are not currently supported in Grafana-managed rules. If the `limit` option is present, the import fails. However, rules with `query` in templates are imported.

{{< admonition type="note" >}}
Rules with the label `__grafana_origin` are not included in rule imports. These rules are typically created by apps such as **Kubernetes Monitoring**, **Synthetic Monitoring**, and other **Grafana plugins**.
{{< /admonition >}}

## Import rules with Grafana Alerting

You can use the Grafana Alerting user interface to import rules from the following sources:

- Connected Mimir and Loki data sources with the ruler API enabled
- Prometheus YAML rule files

Imported rules using this method are editable in the user interface. Like regular Grafana-managed rules, you can later export them for provisioning.

#### Before you begin

To use Grafana Alerting to migrate rules, you need the following [RBAC permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/):

- **Alerting**: `Rules Writer`, `Set provisioning status`.
- **Datasources**: `Reader`.
- **Folders**: `Creator`.

  The Folders permission is optional and only necessary if you want to create new folders for your target namespace. If your account doesn't have permissions to view a namespace, the tool creates a new one.

To convert data source-managed alert rules to Grafana managed alerts:

1. Go to **Alerting > Alert rules**.

2. Navigate to the Data source-managed alert rules section and click **Import to Grafana-managed rules**.

3. Choose the **Import source** from which you want to import rules:
   - Select **Existing data source-managed rules** to import rules from connected Mimir or Loki data sources with the ruler API enabled.
   - Select **Prometheus YAML file** to import rules by uploading a Prometheus YAML rule file.

4. In the **Data source** dropdown, select the data source that the imported alert rules will query.

5. (Optional) In Additional settings, select a target folder or designate a new folder to import the rules into.

   If you import the rules into an existing folder, don't choose a folder with existing alert rules, as they could get overwritten.

6. (Optional) Select a Namespace and/or Group to determine which rules are imported.

7. (Optional) Turn on **Pause imported alerting rules**.

   Pausing stops alert rule evaluation and doesn’t create any alert instances for the newly created Grafana-managed alert rules.

8. (Optional) Turn on **Pause imported recording rules**.

   Pausing stops alert rule evaluation behavior for the newly created Grafana-managed alert rules.

9. (Optional) In the **Target data source** of the **Recording rules** section, you can select the data source that the imported recording rules will query. By default, it is the data source selected in the **Data source** dropdown.

10. Click **Import**.

    A preview shows the rules that will be imported. If your target folder contains folders with the same name of the imported folders, a warning displays to inform you. You can explore the warning to see a list of folders that might be overwritten.

    Click **Yes, import** to import the rules.

## Import rules with command-line tools

You can also use command-line tools to import data source-managed rules as Grafana-managed rules: use `mimirtool` for Mimir and Prometheus rules, and `cortextool` for Loki rules.

Both tools provide `rules` commands to import rules groups. For example:

- `rules load` can import rule groups from files.
- `rules sync` can read rule files and applies only the differences compared to existing Grafana-managed rules. This is useful for automation workflows and pipelines.

By default, rules imported using the API or command-line tools are **Provisioned** and not editable in the user interface. To make them editable, enable the [X-Disable-Provenance](#x-disable-provenance) header.

#### Before you begin

You need to have installed [`mimirtool`](/docs/mimir/latest/manage/tools/mimirtool/) or [`cortextool`](https://github.com/grafana/cortex-tools) (version `0.11.3` or later).

You need a service account with the following [RBAC permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/):

- **Alerting**: `Rules Reader`, `Rules Writer`, `Set provisioning status`.
- **Datasources**: `Reader`.
- **Folders**: `Creator`, `Reader`, `Writer`.

You need to a service account token with your service account. For more details, refer to [service accounts and service account tokens](/docs/grafana/latest/administration/service-accounts/).

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

### Optional Headers

Additional configuration headers for more granular import control include the following:

#### `X-Disable-Provenance`

When this header is set to `true`:

- The imported rules are not marked as provisioned.
- They can then be edited in the Grafana UI.
- They are excluded from the `GET` and `DELETE` operations on the [`/api/convert` endpoints](#compatible-endpoints).

Do not enable this header when using the `rules sync` command, as it relies on the `GET` and `DELETE` operations to detect and update existing rules.

#### `X-Grafana-Alerting-Alert-Rules-Paused`

Set to `true` to import alert rules in paused state.

#### `X-Grafana-Alerting-Recording-Rules-Paused`

Set to `true` to import recording rules in paused state.

#### `X-Grafana-Alerting-Datasource-UID`

The UID of the data source to use for alert rule queries.

#### `X-Grafana-Alerting-Target-Datasource-UID`

The UID of the target data source for recording rules. If not specified, the value from `X-Grafana-Alerting-Datasource-UID` is used.

#### `X-Grafana-Alerting-Folder-UID`

Enter the UID of the target destination folder for imported rules.

#### `X-Grafana-Alerting-Notification-Settings`

JSON-encoded [`AlertRuleNotificationSettings` object](#alertrulenotificationsettings-object) that allows setting the contact point for the alert rules.

{{< collapse title="AlertRuleNotificationSettings object" >}}

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

{{< /collapse >}}

### Compatible endpoints

The API endpoints listed in this section are supported in Grafana and are used by `mimirtool` and `cortextool`, as shown earlier. These endpoints are compatible with [Mimir HTTP API](/docs/mimir/latest/references/http-api/).

In these endpoints, a "namespace" corresponds to a folder title in Grafana.

The `POST` endpoints can be used to import data source–managed alert rules. They accept requests in both YAML and JSON. If no media type is specified, YAML is assumed.

| Endpoint | Method                                                | Summary                                                                                                                                                                                         | Mimir equivalent                                                         |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| POST     | `/convert/prometheus/config/v1/rules`                 | [Create or update multiple rule groups](#create-or-update-multiple-rule-groups) across multiple namespaces. Requires [`X-Grafana-Alerting-Datasource-UID`](#x-grafana-alerting-datasource-uid). | None                                                                     |
| POST     | `/convert/prometheus/config/v1/rules/:namespaceTitle` | Create or update a single rule group in a namespace. Requires [`X-Grafana-Alerting-Datasource-UID`](#x-grafana-alerting-datasource-uid).                                                        | [Set rule group](/docs/mimir/latest/references/http-api/#set-rule-group) |

The `GET` and `DELETE` endpoints work only with provisioned and imported alert rules.

| Endpoint | Method                                                       | Summary                                             | Mimir equivalent                                                                                     |
| -------- | ------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET      | `/convert/prometheus/config/v1/rules`                        | Get all imported rule groups across all namespaces. | [List rule groups](/docs/mimir/latest/references/http-api/#list-rule-groups)                         |
| GET      | `/convert/prometheus/config/v1/rules/:namespaceTitle`        | Get imported rule groups in a specific namespace.   | [Get rule groups by namespace](/docs/mimir/latest/references/http-api/#get-rule-groups-by-namespace) |
| DELETE   | `/convert/prometheus/config/v1/rules/:namespaceTitle`        | Delete all imported alert rules in a namespace.     | [Delete namespace](/docs/mimir/latest/references/http-api/#delete-namespace)                         |
| DELETE   | `/convert/prometheus/config/v1/rules/:namespaceTitle/:group` | Delete a specific imported rule group.              | [Delete rule group](/docs/mimir/latest/references/http-api/#delete-rule-group)                       |

#### Create or update multiple rule groups

```
POST /convert/prometheus/config/v1/rules
```

Creates or updates multiple rule groups across multiple namespaces. This endpoint expects a request with a map of namespace titles to arrays of rule groups, and returns `202` on success.

This endpoint has no Mimir equivalent and is Grafana-specific for bulk operations.

##### Example request body

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
