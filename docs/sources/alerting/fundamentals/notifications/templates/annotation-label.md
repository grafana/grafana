---
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/templates/template-labels-annotations

description: Learn how to use annotations and labels to store key information about alerts and customize alert notifications
keywords:
  - grafana
  - alerting
  - labels
  - annotations
  - templating
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: labels and annotations
title: Labels and annotations
weight: 300
---

# Labels and annotations

Labels and annotations contain information about an alert. Labels are used to differentiate an alert from all other alerts, while annotations are used to add additional information to an existing alert.

When creating alert rules, you can also [template labels and annotations](#template-labels) to optimize and customize your alerts.

## Labels

**Labels** are unique identifiers of an alert. You can use them for searching, silencing, and routing notifications.

Examples of labels are `server=server1` or `team=backend`. Each alert rule can have more than one label and the complete set of labels for an alert rule is called its label set. It is this label set that identifies the alert.

For example, an alert rule might have the label set `{alertname="High CPU usage",server="server1"}` while another alert rule might have the label set `{alertname="High CPU usage",server="server2"}`. These are two separate alert rules because although their `alertname` labels are the same, their `server` labels are different.

Labels are a fundamental component of alerting:

- The complete set of labels for an alert is what uniquely identifies an alert within Grafana alerts.
- The alerting UI shows labels for every alert instance generated during evaluation of that rule.
- Contact points can access labels to send notification messages that contain specific alert information.
- The Alertmanager uses labels to match alerts for silences and alert groups in notification policies.

Note that two alert rules cannot have the same labels. If two alert rules have the same labels such as `foo=bar,bar=baz` and `foo=bar,bar=baz` then one of the alerts will be discarded.

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

- Data source query labels. For example, if you are monitoring temperature readings and each time series for these readings has a `sensor_id`, and a `location` label. These labels are used to provide additional context or dimensions to the metric data, helping to differentiate between different time series.

- Labels that are automatically added by Grafana (i.e. alertname and grafana_folder). These are Grafana reserved labels.

- Labels that you define yourself to help filter data in your alert rules.
  You can also template labels. For example in your alert rule, you could add a label that uses templating to create more dynamic and customizable alerting. E.g. `environment` `=` `{{ your text/template }}`.

{{<admonition type="note">}}
Ensure the label set for an alert does not have two or more labels with the same name. If a label has the same name as a label from the data source then it will replace that label. However, should a label have the same name as a reserved label then the label will be omitted from the alert.
{{</admonition>}}

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

Reserved labels can be used in the same way as manually configured labels. The current list of available reserved labels are:

| Label          | Description                               |
| -------------- | ----------------------------------------- |
| alert_name     | The name of the alert rule.               |
| grafana_folder | Title of the folder containing the alert. |

Labels prefixed with `grafana_` are reserved by Grafana for special use. To stop Grafana Alerting from adding a reserved label, you can disable it via the `disabled_labels` option in [unified_alerting.reserved_labels](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana#unified_alertingreserved_labels) configuration.

### Template labels

Label templates are applied in the alert rule itself (i.e. in the Configure labels and notifications section of an alert).

{{ <admonition type=”note”> }}
Think about templating labels when you need to improve or change how alerts are uniquely identified. This is especially helpful if the labels you get from your query aren't detailed enough. Keep in mind that, it's better to keep long sentences for summaries and descriptions. Also, avoid using the query's value in labels because it might cause Grafana to create many alerts when you actually only need one
{{ </admonition> }}

Templating can be applied by using variables and functions. These variables can represent dynamic values retrieved from your data queries.

{{ <admonition type=”note”> }}
In Grafana templating, the $ and . symbols are used to reference variables and their properties. You can reference variables directly in your alert rule definitions using the $ symbol followed by the variable name. Similarly, you can access properties of variables using the dot (.) notation within alert rule definitions.
{{ </admonition> }}

Here are some commonly used built-in [variables][variables-label-annotation] to interact with the name and value of labels in Grafana alerting:

- The `$labels` variable, which contains all labels from the query.

  For example, let's say you have an alert rule that triggers when the CPU usage exceeds a certain threshold. You want to create annotations that provide additional context when this alert is triggered, such as including the specific server that experienced the high CPU usage.

        The host {{ index $labels "instance" }} has exceeded 80% CPU usage for the last 5 minutes

  The outcome of this template would print:

        The host instance 1 has exceeded 80% CPU usage for the last 5 minutes

- The `$value` variable, which is a string containing the labels and values of all instant queries; threshold, reduce and math expressions, and classic conditions in the alert rule.

  In the context of the previous example, $value variable would write something like this:

        CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes: {{ $value }}

  The outcome of this template would print:

        CPU usage for instance1 has exceeded 80% for the last 5 minutes: [ var='A' labels={instance=instance1} value=81.234 ]

- The `$values` variable is a table containing the labels and floating point values of all instant queries and expressions, indexed by their Ref IDs (i.e. the id that identifies the query or expression. By default the Red ID of the query is “A”).

  Given an alert with the labels instance=server1 and an instant query with the value 81.2345, would write like this:

        CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes: {{ index $values "A" }}

  And it would print:

        CPU usage for instance1 has exceeded 80% for the last 5 minutes: 81.2345

## Annotations

Both labels and annotations have the same structure: a set of named values; however their intended uses are different. The purpose of annotations is to add additional information to existing alerts.

There are a number of suggested annotations in Grafana such as `description`, `summary`, `runbook_url`, `dashboardUId` and `panelId`. Like labels, annotations must have a name, and their value can contain a combination of text and template code that is evaluated when an alert is fired.

Here is an example of templating an annotation in the context of an alert rule. The text/template is added into the Add annotations section.

        CPU usage for {{ index $labels "instance" }} has exceeded 80% for the last 5 minutes

The outcome of this template would print

        CPU usage for Instance 1 has exceeded 80% for the last 5 minutes

{{% docs/reference %}}
[variables-label-annotation]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templating-labels-annotations"
[variables-label-annotation]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/templating-labels-annotations"
{{% /docs/reference %}}
