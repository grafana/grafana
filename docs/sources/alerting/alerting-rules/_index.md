---
aliases:
  - old-alerting/create-alerts/
  - rules/
  - unified-alerting/alerting-rules/
  - ./create-alerts/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/
description: Configure alert rules
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure alert rules
weight: 120
---

# Configure alert rules

An alert rule consists of one or more queries and expressions that select the data you want to measure. It also contains a condition, which is the threshold that an alert rule must meet or exceed in order to fire.

Create, manage, view, and adjust alert rules to alert on your metrics data or log entries from multiple data sources — no matter where your data is stored.

The main parts of alert rule creation are:

1. Select your data source
1. Query your data
1. Normalize your data
1. Set your threshold

**Query, expressions, and alert condition**

What are you monitoring? How are you measuring it?

{{< admonition type="note" >}}
Expressions can only be used for Grafana-managed alert rules.
{{< /admonition >}}

**Evaluation**

How do you want your alert to be evaluated?

**Labels and notifications**

How do you want to route your alert? What kind of additional labels could you add to annotate your alert rules and ease searching?

**Annotations**

Do you want to add more context on the alert in your notification messages, for example, what caused the alert to fire? Which server did it happen on?
