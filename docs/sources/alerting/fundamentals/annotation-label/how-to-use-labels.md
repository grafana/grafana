---
aliases:
  - /docs/grafana/latest/alerting/fundamentals/annotation-label/how-to-use-labels/
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
- The Alertmanager uses labels to match alerts for [silences]({{< relref "../../silences/" >}}) and [alert groups]({{< relref "../../alert-groups/" >}}) in [notification policies]({{< relref "../../notifications/" >}}).
- The alerting UI shows labels for every alert instance generated during evaluation of that rule.
- Contact points can access labels to dynamically generate notifications that contain information specific to the alert that is resulting in a notification.
- You can add labels to an [alerting rule]({{< relref "../../alerting-rules/" >}}). Labels are manually configurable, use template functions, and can reference other labels. Labels added to an alerting rule take precedence in the event of a collision between labels (except in the case of [Grafana reserved labels](#grafana-reserved-labels)).

{{< figure src="/static/img/docs/alerting/unified/rule-edit-details-8-0.png" max-width="550px" caption="Alert details" >}}

# Grafana reserved labels

> **Note:** Labels prefixed with `grafana_` are reserved by Grafana for special use. If a manually configured label is added beginning with `grafana_` it may be overwritten in case of collision.

Grafana reserved labels can be used in the same way as manually configured labels. The current list of available reserved labels are:

| Label          | Description                               |
| -------------- | ----------------------------------------- |
| grafana_folder | Title of the folder containing the alert. |
