---
aliases:
  - ../alerting-rules/alert-annotation-label/
  - ../unified-alerting/alerting-rules/alert-annotation-label/
description: Annotations and labels for alerting
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - create
title: Labels and annotations
weight: 110
---

# Labels and annotations

Labels and annotations contain information about an alert. Both labels and annotations have the same structure: a set of named values; however their intended uses are different. An example of label, or the equivalent annotation, might be `alertname="test"`.

The main difference between a label and an annotation is that labels are used to differentiate an alert from all other alerts, while annotations are used to add additional information to an existing alert.

For example, consider two high CPU alerts: one for `server1` and another for `server2`. In such an example we might have a label called `server` where the first alert has the label `server="server1"` and the second alert has the label `server="server2"`. However, we might also want to add a description to each alert such as `"The CPU usage for server1 is above 75%."`, where `server1` and `75%` are replaced with the name and CPU usage of the server (please refer to the documentation on [templating labels and annotations]({{< relref "./variables-label-annotation" >}}) for how to do this). This kind of description would be more suitable as an annotation.

## Labels

Labels contain information that identifies an alert. An example of a label might be `server=server1`. Each alert can have more than one label, and the complete set of labels for an alert is called its label set. It is this label set that identifies the alert.

For example, an alert might have the label set `{alertname="High CPU usage",server="server1"}` while another alert might have the label set `{alertname="High CPU usage",server="server2"}`. These are two separate alerts because although their `alertname` labels are the same, their `server` labels are different.

The label set for an alert is a combination of the labels from the datasource, custom labels from the alert rule, and a number of reserved labels such as `alertname`.

### Custom Labels

Custom labels are additional labels from the alert rule. Like annotations, custom labels must have a name, and their value can contain a combination of text and template code that is evaluated when an alert is fired. Documentation on how to template custom labels can be found [here]({{< relref "./variables-label-annotation" >}}).

When using custom labels with templates it is important to make sure that the label value does not change between consecutive evaluations of the alert rule as this will end up creating large numbers of distinct alerts. However, it is OK for the template to produce different label values for different alerts. For example, do not put the value of the query in a custom label as this will end up creating a new set of alerts each time the value changes. Instead use annotations.

It is also important to make sure that the label set for an alert does not have two or more labels with the same name. If a custom label has the same name as a label from the datasource then it will replace that label. However, should a custom label have the same name as a reserved label then the custom label will be omitted from the alert.

## Annotations

Annotations are named pairs that add additional information to existing alerts. There are a number of suggested annotations in Grafana such as `description`, `summary`, `runbook_url`, `dashboardUId` and `panelId`. Like custom labels, annotations must have a name, and their value can contain a combination of text and template code that is evaluated when an alert is fired. If an annotation contains template code, the template is evaluated once when the alert is fired. It is not re-evaluated, even when the alert is resolved. Documentation on how to template annotations can be found [here]({{< relref "./variables-label-annotation" >}}).
