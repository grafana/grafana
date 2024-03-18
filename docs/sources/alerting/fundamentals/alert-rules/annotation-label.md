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
---

# Labels and annotations

Labels and annotations contain information about an alert. Labels are used to differentiate an alert from all other alerts, while annotations are used to add additional information to an existing alert.

## Labels

Labels contain information that identifies an alert. An example of a label might be `server=server1` or `team=backend`. Each alert can have more than one label, and the complete set of labels for an alert is called its label set. It is this label set that identifies the alert.

For example, an alert might have the label set `{alertname="High CPU usage",server="server1"}` while another alert might have the label set `{alertname="High CPU usage",server="server2"}`. These are two separate alerts because although their `alertname` labels are the same, their `server` labels are different.

Labels are a fundamental component of alerting:

- The complete set of labels for an alert is what uniquely identifies an alert within Grafana alerts.
- The alerting UI shows labels for every alert instance generated during evaluation of that rule.
- Contact points can access labels to send notification messages that contain specific alert information.
- The Alertmanager uses labels to match alerts for silences and alert groups in notification policies.

### How label matching works

Use labels and label matchers to link alert rules to notification policies and silences. This allows for a flexible way to manage your alert instances, specify which policy should handle them, and which alerts to silence.

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

{{< collapse title="Label matching example" >}}

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

## Label types

An alert's label set can contain three types of labels:

- Labels from the datasource,
- Custom labels specified in the alert rule,
- A series of reserved labels, such as `alertname` or `grafana_folder`.

### Custom Labels

Custom labels are additional labels configured manually in the alert rule.

Ensure the label set for an alert does not have two or more labels with the same name. If a custom label has the same name as a label from the datasource then it will replace that label. However, should a custom label have the same name as a reserved label then the custom label will be omitted from the alert.

{{< collapse title="Key format" >}}

Grafana's built-in Alertmanager supports both Unicode label keys and values. If you are using an external Prometheus Alertmanager, label keys must be compatible with their [data model](https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).
This means that label keys must only contain **ASCII letters**, **numbers**, as well as **underscores** and match the regex `[a-zA-Z_][a-zA-Z0-9_]*`.
Any invalid characters will be removed or replaced by the Grafana alerting engine before being sent to the external Alertmanager according to the following rules:

- `Whitespace` will be removed.
- `ASCII characters` will be replaced with `_`.
- `All other characters` will be replaced with their lower-case hex representation. If this is the first character it will be prefixed with `_`.

Example: A label key/value pair `Alert! 🔔="🔥"` will become `Alert_0x1f514="🔥"`.

If multiple label keys are sanitized to the same value, the duplicates will have a short hash of the original label appended as a suffix.

{{< /collapse >}}

### Reserved labels

Reserved labels can be used in the same way as manually configured custom labels. The current list of available reserved labels are:

| Label          | Description                               |
| -------------- | ----------------------------------------- |
| alert_name     | The name of the alert rule.               |
| grafana_folder | Title of the folder containing the alert. |

Labels prefixed with `grafana_` are reserved by Grafana for special use. To stop Grafana Alerting from adding a reserved label, you can disable it via the `disabled_labels` option in [unified_alerting.reserved_labels](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana#unified_alertingreserved_labels) configuration.

## Annotations

Both labels and annotations have the same structure: a set of named values; however their intended uses are different. The purpose of annotations is to add additional information to existing alerts.

There are a number of suggested annotations in Grafana such as `description`, `summary`, `runbook_url`, `dashboardUId` and `panelId`. Like custom labels, annotations must have a name, and their value can contain a combination of text and template code that is evaluated when an alert is fired.

{{% docs/reference %}}
[variables-label-annotation]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templating-labels-annotations"
[variables-label-annotation]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templating-labels-annotations"
{{% /docs/reference %}}
