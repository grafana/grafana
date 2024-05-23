---
aliases:
  - ../../fundamentals/annotation-label/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/annotation-label/
  - ../../fundamentals/annotation-label/labels-and-label-matchers/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/annotation-label/labels-and-label-matchers/
  - ../../fundamentals/annotation-label/how-to-use-labels/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/annotation-label/how-to-use-labels/
  - ../../alerting-rules/alert-annotation-label/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alert-annotation-label/
  - ../../unified-alerting/alerting-rules/alert-annotation-label/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/alert-annotation-label/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/annotation-label/
description: Learn how to use annotations and labels to store key information about alerts
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - create
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Labels and annotations
weight: 105
refs:
  create-alerts-from-panel:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule#create-alerts-from-panels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule#create-alerts-from-panels
  templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/templates/
  alert-rule-evaluation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/
  silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
---

# Labels and annotations

Labels and annotations add additional information about an alert using key/value pairs:

- [Labels](#labels) are used to differentiate an alert from all other alerts.
- [Annotations](#annotations) are used to provide extra details to an existing alert.

## Labels

**Labels** are unique identifiers of an alert instance. You can use them for searching, silencing, and routing notifications.

Examples of labels are `server=server1` or `team=backend`. Each alert rule can have more than one label and the complete set of labels for an alert rule is called its label set. It is this label set that identifies the alert.

For example, an alert instance might have the label set `{alertname="High CPU usage",server="server1"}` while another alert instance might have the label set `{alertname="High CPU usage",server="server2"}`. These are two separate alert instances because although their `alertname` labels are the same, their `server` labels are different.

{{< figure src="/static/img/docs/alerting/unified/multi-dimensional-alert.png" >}}

Labels are a fundamental component of alerting:

- The complete set of labels for an alert is what uniquely identifies an alert instance.
- The alerting UI shows labels for every alert instance generated during evaluation of that rule.
- [Notification policies](ref:notification-policies) and [silences](ref:silences) use labels to match alert instances and route them to contact points or stop their notifications.
- Contact points can include information from labels in notification messages.

### Label types

An alert's label set can contain three types of labels:

**User-configured labels**

Labels that you manually configure in the alert rule to identify the generated alert instances or group them.

You can also use a [template](ref:templates) to customize the label value and generate dynamic values when the rule is evaluated.

**Data source query labels**

For example, if you are monitoring temperature readings and each time series for these readings has a `sensor_id`, and a `location` label, an alert instance might have the labels `{sensor_id="1",location="NY"}`, while another alert instance might have `{sensor_id="2",location="WA"}`.

Data source query labels labels are also used to generate multiple alert instances from the same alert rule, helping to distinguish alerts from different data.

**Reserved labels**

Reserved labels are automatically added by Grafana:

- `alert_name`: the name of the alert rule.
- `grafana_folder`: the title of the folder containing the alert.

Labels prefixed with `grafana_` are reserved by Grafana for special use. To stop Grafana Alerting from adding a reserved label, you can disable it via the `disabled_labels` option in [unified_alerting.reserved_labels](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana#unified_alertingreserved_labels) configuration.

{{<admonition type="note">}}

Two alert rules cannot produce alert instances with the same labels. If two alert rules have the same labels such as `foo=bar,bar=baz` and `foo=bar,bar=baz` then one of the generated alert instances will be discarded.

Ensure the label set for an alert does not have two or more labels with the same name.

- If a configured label has the same name as a data source query label, it will replace the data source label.
- If a configured label has the same name as a reserved label, it will be omitted.
  {{</admonition>}}

{{< collapse title="Label key format" >}}

Grafana's built-in Alertmanager supports both Unicode label keys and values. If you are using an external Prometheus Alertmanager, label keys must be compatible with their [data model](https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).
This means that label keys must only contain **ASCII letters**, **numbers**, as well as **underscores** and match the regex `[a-zA-Z_][a-zA-Z0-9_]*`.
Any invalid characters will be removed or replaced by the Grafana alerting engine before being sent to the external Alertmanager according to the following rules:

- `Whitespace` will be removed.
- `ASCII characters` will be replaced with `_`.
- `All other characters` will be replaced with their lower-case hex representation. If this is the first character it will be prefixed with `_`.

Example: A label key/value pair `Alert! 🔔="🔥"` will become `Alert_0x1f514="🔥"`.

If multiple label keys are sanitized to the same value, the duplicates will have a short hash of the original label appended as a suffix.

{{< /collapse >}}

{{< collapse title="How label matching works" >}}

Use labels and label matchers to link alert rules to [notification policies](ref:notification-policies) and [silences](ref:silences). This allows for a flexible way to manage your alert instances, specify which policy should handle them, and which alerts to silence.

A label matchers consists of 3 distinct parts, the **label**, the **value** and the **operator**.

- The **Label** field is the name of the label to match. It must exactly match the label name.

- The **Value** field matches against the corresponding value for the specified **Label** name. How it matches depends on the **Operator** value.

- The **Operator** field is the operator to match against the label value. The available operators are:

  | Operator | Description                                        |
  | -------- | -------------------------------------------------- |
  | `=`      | Select labels that are exactly equal to the value. |
  | `!=`     | Select labels that are not equal to the value.     |
  | `=~`     | Select labels that regex-match the value.          |
  | `!~`     | Select labels that do not regex-match the value.   |

If you are using multiple label matchers, they are combined using the AND logical operator. This means that all matchers must match in order to link a rule to a policy.

**Label matching example**

If you define the following set of labels for your alert:

`{ foo=bar, baz=qux, id=12 }`

then:

- A label matcher defined as `foo=bar` matches this alert rule.
- A label matcher defined as `foo!=bar` does _not_ match this alert rule.
- A label matcher defined as `id=~[0-9]+` matches this alert rule.
- A label matcher defined as `baz!~[0-9]+` matches this alert rule.
- Two label matchers defined as `foo=bar` and `id=~[0-9]+` match this alert rule.

**Exclude labels**

You can also write label matchers to exclude labels.

Here is an example that shows how to exclude the label `Team`. You can choose between any of the values below to exclude labels.

| Label  | Operator | Value |
| ------ | -------- | ----- |
| `team` | `=`      | `""`  |
| `team` | `!~`     | `.+`  |
| `team` | `=~`     | `^$`  |

{{< /collapse >}}

## Annotations

The purpose of annotations is to add additional information to alert instances, such as extra details for notification messages.

Grafana provides several optional annotations that are used in the default notification messages and Grafana:

- `summary`: A short summary of what the alert has detected and why.
- `description`: a detailed description of what happened and what the alert does.
- `runbook_url`: the runbook page to guide operators managing the potential incident.
- `dashboardUId` and `panelId`: link the alert to a dashboard and panel. Automatically set when [creating an alert from panels](ref:create-alerts-from-panel).

Like labels, annotations can use a [template](ref:templates) to customize the label value and generate dynamic values when the rule is evaluated.
