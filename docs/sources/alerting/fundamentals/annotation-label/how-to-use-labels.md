---
description: Learn about labels and label matchers in alerting
keywords:
  - grafana
  - alerting
  - guide
  - fundamentals
title: Labels in Grafana Alerting
weight: 117
---

# Labels in Grafana Alerting

This topic explains why labels are a fundamental component of alerting.

- The complete set of labels for an alert is what uniquely identifies an alert within Grafana alerts.
- The Alertmanager uses labels to match alerts for silences and alert groups in notification policies.
- The alerting UI shows labels for every alert instance generated during evaluation of that rule.
- Contact points can access labels to dynamically generate notifications that contain information specific to the alert that is resulting in a notification.
- You can add labels to an [alerting rule]({{< relref "../../alerting-rules/" >}}). Labels are manually configurable, use template functions, and can reference other labels. Labels added to an alerting rule take precedence in the event of a collision between labels (except in the case of [Grafana reserved labels](#grafana-reserved-labels)).

{{< figure src="/static/img/docs/alerting/unified/rule-edit-details-8-0.png" max-width="550px" caption="Alert details" >}}

# External Alertmanager Compatibility

Grafana's built-in Alertmanager supports both Unicode label keys and values. If you are using an external Prometheus Alertmanager, label keys must be compatible with their [data model](https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).
This means that label keys must only contain **ASCII letters**, **numbers**, as well as **underscores** and match the regex `[a-zA-Z_][a-zA-Z0-9_]*`.
Any invalid characters will be removed or replaced by the Grafana alerting engine before being sent to the external Alertmanager according to the following rules:

- `Whitespace` will be removed.
- `ASCII characters` will be replaced with `_`.
- `All other characters` will be replaced with their lower-case hex representation. If this is the first character it will be prefixed with `_`.

Example: A label key/value pair `Alert! 🔔="🔥"` will become `Alert_0x1f514="🔥"`.

**Note** If multiple label keys are sanitized to the same value, the duplicates will have a short hash of the original label appended as a suffix.

# Grafana reserved labels

> **Note:** Labels prefixed with `grafana_` are reserved by Grafana for special use. If a manually configured label is added beginning with `grafana_` it may be overwritten in case of collision.
> To stop the Grafana Alerting engine from adding a reserved label, you can disable it via the `disabled_labels` option in [unified_alerting.reserved_labels]({{< relref "../../../setup-grafana/configure-grafana/#unified_alertingreserved_labels" >}}) configuration.

Grafana reserved labels can be used in the same way as manually configured labels. The current list of available reserved labels are:

| Label          | Description                               |
| -------------- | ----------------------------------------- |
| grafana_folder | Title of the folder containing the alert. |
