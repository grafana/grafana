---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/data-source-managed-alerts/
description: Learn about legacy support in Grafana Alerting for data source-managed alert rules and other Alertmanagers, and the recommended alternatives
keywords:
  - grafana
  - alerting
  - data source-managed
  - Mimir
  - Loki
  - Prometheus
  - Alertmanager
  - legacy
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Legacy data source-managed alerts
title: Legacy data source-managed alerts
weight: 900
---

# Legacy data source-managed alerts

Data source-managed alerts come from alert rules that are stored and evaluated in a Prometheus-compatible data source, such as Mimir, Loki, or Prometheus, rather than in Grafana. An Alertmanager other than the built-in Grafana Alertmanager, such as a Mimir or Prometheus Alertmanager, handles their notifications.

Grafana Alerting focuses on Grafana-managed alert rules and the Grafana Alertmanager. Support for data source-managed alerts in the Grafana Alerting UI is legacy functionality, and the other sections of the Grafana Alerting documentation describe Grafana-managed alerts only.

{{< admonition type="caution" >}}
In Grafana Cloud, data source-managed alerts for the default Loki and Prometheus data sources are deprecated. New Grafana Cloud stacks use Grafana-managed alerts by default, and Grafana Labs doesn't provision data source-managed alerting or the Grafana Cloud Alertmanager for them. Existing stacks aren't affected.

If you add your own Mimir, Loki, or Alertmanager data sources, you can continue to use data source-managed alerts.
{{< /admonition >}}

## Choose how to manage data source-managed alerts

If you have alert rules or an Alertmanager configuration stored outside of Grafana, you have the following options:

- **Import them into Grafana Alerting**: This is the recommended option. Convert your rules with [Import data source-managed rules to Grafana-managed rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/), and convert your notification setup with [Import an Alertmanager configuration](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/import-alertmanager-configuration/). Grafana-managed alert rules provide a [richer feature set](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/create-data-source-managed-rule/#comparison-with-grafana-managed-rules) than data source-managed alert rules.
- **Use the Prometheus Alerting plugin**: Keep your rules and Alertmanager configuration in your data sources, and manage them in Grafana with the [Prometheus Alerting](/docs/plugins/grafana-prometheusalerting-app/latest/) app plugin. The plugin manages data source-managed alert rules and Alertmanager configuration for Prometheus, Mimir, Cortex, and Loki data sources. It requires Grafana 13.1.0 or later.
- **Use the legacy workflows in Grafana Alerting**: Follow the topics in this section to manage data source-managed resources in the Grafana Alerting UI.

## Legacy workflows in Grafana Alerting

The following topics describe how to work with data source-managed resources in the Grafana Alerting UI:

- [Configure data source-managed alert rules](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/create-data-source-managed-rule/): Compare the two types of alert rules, and create alert rules that Mimir or Loki stores and evaluates.
- [Create data source-managed recording rules](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/create-data-source-managed-recording-rules/): Create recording rules that Mimir or Loki stores and evaluates.
- [Manage notification resources in other Alertmanagers](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/manage-alertmanager-resources/): Manage contact points, notification policies, mute timings, and silences in an Alertmanager other than the Grafana Alertmanager.

To add an Alertmanager to Grafana, or to send Grafana-managed alerts to it, refer to [Configure Alertmanagers](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/).
