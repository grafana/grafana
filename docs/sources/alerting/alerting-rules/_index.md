---
aliases:
  - old-alerting/create-alerts/
  - rules/
  - unified-alerting/alerting-rules/
  - ./create-alerts/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/
description: Configure the features and integrations you need to create and manage your alerts
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure Alerting
weight: 120
refs:
  manage-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/manage-contact-points/
  create-notification-policy:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-notification-policy/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-notification-policy/
  create-mimir-loki-managed-recording-rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
  create-grafana-managed-rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
  create-mimir-loki-managed-rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-mimir-loki-managed-rule/
---

# Configure Alerting

Configure the features and integrations that you need to create and manage your alerts.

**Configure alert rules**

[Configure Grafana-managed alert rules](ref:create-grafana-managed-rule).

[Configure data source-managed alert rules](ref:create-mimir-loki-managed-rule)

**Configure recording rules**

_Recording rules are only available for compatible Prometheus or Loki data sources._

For more information, see [Configure recording rules](ref:create-mimir-loki-managed-recording-rule).

**Configure contact points**

For information on how to configure contact points, see [Configure contact points](ref:manage-contact-points).

**Configure notification policies**

For information on how to configure notification policies, see [Configure notification policies](ref:create-notification-policy).
