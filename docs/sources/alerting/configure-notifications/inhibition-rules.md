---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/inhibition-rules/
description: Use inhibition rules to suppress notifications for target alerts when a related source alert is already firing. Inhibition rules let you reduce noise by suppressing redundant alerts caused by a known root cause.
keywords:
  - grafana
  - alerting
  - guide
  - inhibition rules
  - suppress
  - silence
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure inhibition rules
weight: 450
refs:
  configure-alertmanager:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
  shared-silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
  alertmanager-architecture:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/#alertmanager-architecture
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/#alertmanager-architecture
---

# Configure inhibition rules

{{< admonition type="note" >}}
Available in Grafana 13 or higher.
{{< /admonition >}}

An inhibition rule suppresses notifications for target alerts when source alerts with matching label values are already firing. This lets you reduce noise when a root-cause alert makes dependent alerts redundant.

For example, if a node is down (the **source**), you can inhibit all alerts for services running on that node (the **target**). This prevents your team from receiving individual alerts for each affected service when the underlying cause is already captured in the source alert.

{{< admonition type="note" >}}
Inhibition rules are assigned to a [specific Alertmanager](ref:alertmanager-architecture) and only suppress notifications for alerts managed by that Alertmanager.
{{< /admonition >}}

## Inhibition rules vs silences

Both inhibition rules and [silences](ref:shared-silences) suppress alert notifications. The key difference is that inhibition rules suppress alerts automatically based on the presence of another alert, while silences suppress alerts for a fixed time window regardless of other alerts.

|              | Inhibition rule                               | Silence                                |
| ------------ | --------------------------------------------- | -------------------------------------- |
| **Trigger**  | Active when a matching source alert is firing | Active during a configured time window |
| **Duration** | Lasts as long as the source alert fires       | Has a fixed start and end time         |
| **Setup**    | Defined as a persistent configuration         | Created manually per occurrence        |

## Manage inhibition rules

You can manage inhibition rules by using the Grafana App Platform API. There is no dedicated UI for creating or editing inhibition rules.

The API resource is:

- **Group:** `notifications.alerting.grafana.app`
- **Version:** `v0alpha1`
- **Resource:** `inhibitionrules`

{{< admonition type="caution" >}}
The inhibition rules API is currently in alpha (`v0alpha1`) and is subject to change.
{{< /admonition >}}

Inhibition rules are also supported in the Prometheus Alertmanager. Refer to [Configure Alertmanager](ref:configure-alertmanager) to set up an external Alertmanager.

## Inhibition rule schema

Each inhibition rule has the following fields:

| Field             | Required | Description                                                                                            |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `name`            | Yes      | Unique name for the inhibition rule. Immutable after creation.                                         |
| `source_matchers` | Yes      | One or more matchers that identify source (inhibiting) alerts.                                         |
| `target_matchers` | Yes      | One or more matchers that identify target (inhibited) alerts.                                          |
| `equal`           | No       | Labels that must have equal values in both source and target alerts for the inhibition to take effect. |

### Matcher format

Both `source_matchers` and `target_matchers` are lists of structured matcher objects. Each matcher has:

| Field   | Description                                                                  |
| ------- | ---------------------------------------------------------------------------- |
| `label` | The name of the label to match against.                                      |
| `type`  | The matching operator. One of `=`, `!=`, `=~`, `!~`.                         |
| `value` | The value to match against. For `=~` and `!~`, this is a regular expression. |

| Operator | Description                                                          |
| -------- | -------------------------------------------------------------------- |
| `=`      | Select alerts where the label equals the value.                      |
| `!=`     | Select alerts where the label does not equal the value.              |
| `=~`     | Select alerts where the label matches the regular expression.        |
| `!~`     | Select alerts where the label does not match the regular expression. |

### The `equal` field

When `equal` is specified, the inhibition only applies when the source and target alerts have the same value for each listed label. For example, setting `equal: [cluster]` ensures that an alert in one cluster only inhibits alerts in the same cluster.

If `equal` is omitted, any firing source alert matching `source_matchers` inhibits all matching target alerts regardless of their label values.

Missing labels and empty-value labels are treated as equivalent for the purpose of `equal` matching.

## Example: suppress warning alerts

The following example defines an inhibition rule that suppresses all `warning`-severity alerts in a cluster when a `critical`-severity alert is already firing for the same cluster.

```json
{
  "name": "critical-inhibits-warnings",
  "source_matchers": [{ "label": "severity", "type": "=", "value": "critical" }],
  "target_matchers": [{ "label": "severity", "type": "=", "value": "warning" }],
  "equal": ["cluster", "namespace"]
}
```

In this example:

- The _source_ matcher selects `critical` alerts. When one fires, the rule becomes active.
- The _target_ matcher selects `warning` alerts. The rule suppresses these while the source alert fires.
- The `equal` field ensures suppression only applies when source and target share the same `cluster` and `namespace` label values.
