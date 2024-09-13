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
  alert-instances:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals#alert-instances
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals#alert-instances
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
- [Annotations](#annotations) are used to provide extra detail on an existing alert.

## Labels

**Labels** are unique identifiers of an [alert instance](ref:alert-instances). You can use them for searching, silencing, and routing notifications.

Examples of labels are `server=server1` or `team=backend`. Each alert rule can have more than one label and the complete set of labels for an alert rule is called its label set. It is this label set that identifies the alert.

For example, an alert instance might have the label set `{alertname="High CPU usage",server="server1"}` while another alert instance might have the label set `{alertname="High CPU usage",server="server2"}`. These are two separate alert instances because although their `alertname` labels are the same, their `server` labels are different.

{{< figure alt="Image shows an example of an alert instance and the labels used on the alert instance." src="/static/img/docs/alerting/unified/multi-dimensional-alert.png" >}}

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

Two alert rules cannot produce alert instances with the same labels. If two alert rules have the same labels such as `foo=bar,bar=baz` and `foo=bar,bar=baz` then one of the generated alert instances is discarded.

Ensure the label set for an alert does not have two or more labels with the same name.

- If a configured label has the same name as a data source query label, it replaces the data source label.
- If a configured label has the same name as a reserved label, it is omitted.
  {{</admonition>}}

{{< collapse title="Label key format" >}}

Grafana has a built-in Alertmanager that supports both Unicode label keys and values. If you are using an external Prometheus Alertmanager, label keys must be compatible with their [data model](https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).
This means that label keys must only contain _ASCII letters_, _numbers_, and _underscores_.
Label keys must also be matched by the regular expression `[a-zA-Z_][a-zA-Z0-9_]*`.
Any invalid characters are removed or replaced by the Grafana alerting engine before being sent to the external Alertmanager according to the following rules:

- Whitespace is removed.
- ASCII characters are replaced with `_`.
- All other characters are replaced with their lower-case hex representation.
  If this is the first character it's prefixed with `_`.

Example: A label key/value pair `Alert! 🔔="🔥"` will become `Alert_0x1f514="🔥"`.

If multiple label keys are sanitized to the same value, the duplicates have a short hash of the original label appended as a suffix.

{{< /collapse >}}

## Annotations

The purpose of annotations is to add additional information to alert instances, such as extra details for notification messages.

Grafana provides several optional annotations that you can edit for use in notification messages and within Grafana.

- `summary`: A short summary of what the alert has detected and why.
- `description`: A detailed description of what happened and what the alert does.
- `runbook_url`: The runbook page to guide operators managing a potential incident.
- `dashboardUId` and `panelId`: Link the alert to a dashboard and panel. These are automatically set when [creating an alert from panels](ref:create-alerts-from-panel).

Like labels, annotations can use a [template](ref:templates) to customize the label value and generate dynamic values when the rule is evaluated.
