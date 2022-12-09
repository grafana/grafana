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
- The Alertmanager uses labels to match alerts for [silences]({{< relref "../../silences/" >}}) and [alert groups]({{< relref "../../alert-groups/" >}}) in [notification policies]({{< relref "../../notifications/" >}}).
- The alerting UI shows labels for every alert instance generated during evaluation of that rule.
- Contact points can access labels to dynamically generate notifications that contain information specific to the alert that is resulting in a notification.
- Labels can be added to an [alerting rule]({{< relref "../../alerting-rules/" >}}). These manually configured labels are able to use template functions and reference other labels. Labels added to an alerting rule take precedence in the event of a collision between labels.

{{< figure src="/static/img/docs/alerting/unified/rule-edit-details-8-0.png" max-width="550px" caption="Alert details" >}}
