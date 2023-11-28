---
aliases:
  - old-alerting/create-alerts/
  - rules/
  - unified-alerting/alerting-rules/
  - ./create-alerts/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/
description: Configure alerting
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure Alerting
weight: 130
---

# Configure Alerting

Configure the features and integrations that you need to create and manage your alerts.

**Configure alert rules**

[Configure Grafana-managed alert rules][create-grafana-managed-rule].

[Configure data source-managed alert rules][create-mimir-loki-managed-rule]

**Configure recording rules**

_Recording rules are only available for compatible Prometheus or Loki data sources._

For more information, see [Configure recording rules][create-mimir-loki-managed-recording-rule].

**Configure contact points**

For information on how to configure contact points, see [Configure contact points][manage-contact-points].

**Configure notification policies**

For information on how to configure notification policies, see [Configure notification policies][create-notification-policy].

{{% docs/reference %}}
[create-mimir-loki-managed-rule]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/alerting-rules/create-mimir-loki-managed-rule"
[create-mimir-loki-managed-rule]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-mimir-loki-managed-rule"

[create-mimir-loki-managed-recording-rule]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/alerting-rules/create-mimir-loki-managed-recording-rule"
[create-mimir-loki-managed-recording-rule]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-mimir-loki-managed-recording-rule"

[create-grafana-managed-rule]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/alerting-rules/create-grafana-managed-rule"
[create-grafana-managed-rule]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule"

[manage-contact-points]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/alerting-rules/manage-contact-points"
[manage-contact-points]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/manage-contact-points"

[create-notification-policy]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/alerting-rules/create-notification-policy"
[create-notification-policy]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-notification-policy"
{{% /docs/reference %}}
