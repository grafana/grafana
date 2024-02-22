---
aliases:
  - old-alerting/create-alerts/
  - rules/
  - unified-alerting/alerting-rules/
  - ./create-alerts/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/
description: Create and manage alert rules
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Create and manage alert rules
title: Create and manage alert rules
weight: 120
---

# Create and manage alert rules

An alert rule consists of one or more queries and expressions that select the data you want to measure. It also contains a condition, which is the threshold that an alert rule must meet or exceed in order to fire.

The main components of an alert rule are:

**Query and alert condition**

What are you monitoring? How are you measuring it?

**Evaluation**

How do you want your alert to be evaluated?

**Labels and notifications**

How do you want to route your alert? What kind of additional labels could you add to annotate your alert rules and ease searching?

**Annotations**

Do you want to add more context on the alert in your notification messages, for example, what caused the alert to fire? Which server did it happen on?

Create, manage, view, and adjust alert rules to alert on your metrics data or log entries from multiple data sources — no matter where your data is stored.

[Create Grafana-managed alert rules][create-grafana-managed-rule].

[Create data source-managed alert rules][create-mimir-loki-managed-rule]

[Create recording rules][create-mimir-loki-managed-recording-rule]

{{< admonition type="note" >}}
Recording rules are only available for compatible Prometheus or Loki data sources.
{{< /admonition >}}


{{% docs/reference %}}
[create-mimir-loki-managed-rule]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-rule"
[create-mimir-loki-managed-rule]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-mimir-loki-managed-rule"

[create-mimir-loki-managed-recording-rule]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-recording-rule"
[create-mimir-loki-managed-recording-rule]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-mimir-loki-managed-recording-rule"

[create-grafana-managed-rule]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule"
[create-grafana-managed-rule]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule"
{{% /docs/reference %}}
