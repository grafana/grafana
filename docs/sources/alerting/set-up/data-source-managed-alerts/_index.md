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

- **Import them into Grafana Alerting**: This is the recommended option. Convert your rules with [Import data source-managed rules to Grafana-managed rules](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/alerting-migration/), and convert your notification setup with [Import an Alertmanager configuration](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/import-alertmanager-configuration/). Grafana-managed alert rules provide a [richer feature set](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/create-data-source-managed-rule/#comparison-with-grafana-managed-rules) than data source-managed alert rules.
- **Use the Prometheus Alerting plugin**: Keep your rules and Alertmanager configuration in your data sources, and manage them in Grafana with the [Prometheus Alerting](/docs/plugins/grafana-prometheusalerting-app/latest/) app plugin. The plugin manages data source-managed alert rules and Alertmanager configuration for Prometheus, Mimir, Cortex, and Loki data sources. It requires Grafana 13.1.0 or later.
- **Use the legacy workflows in Grafana Alerting**: Follow the topics in this section to manage data source-managed resources in the Grafana Alerting UI. These workflows are only available when the Prometheus Alerting plugin isn't installed.

## When the Prometheus Alerting plugin is installed

When the [Prometheus Alerting](/docs/plugins/grafana-prometheusalerting-app/latest/) app plugin is installed and enabled, Grafana Alerting hands data source-managed alerts over to the plugin. The Grafana Alerting UI changes in the following ways:

- **Rule list**: The rule list doesn't show data source-managed alert rules and recording rules. A notice at the top of the list shows how many data sources the plugin manages. Click **View rules in Prometheus Alerting** to open the rules in the plugin.
- **Rule pages**: Links to view or edit a data source-managed rule or rule group open the rule or group in the plugin.
- **Rule creation**: The alert rule form doesn't offer the **Data source-managed** rule type, and the form for data source-managed recording rules opens in the plugin.
- **Other Alertmanagers**: The **Choose Alertmanager** dropdown lists other Alertmanagers under **External Alertmanagers (opens in Prometheus Alerting)**. Selecting one opens the matching page in the plugin, for example its receivers, routes, time intervals, or silences.
- **Settings**: The **Settings** page still lets you [enable or disable an Alertmanager to receive Grafana-managed alerts](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/#enable-an-alertmanager-to-receive-grafana-managed-alerts). To edit the configuration of another Alertmanager, use the plugin.

The legacy workflows in this section don't apply in this case. To manage your data source-managed resources, refer to the plugin documentation:

- [Configure alert rules](/docs/plugins/grafana-prometheusalerting-app/latest/alerting-rules/)
- [Configure notifications](/docs/plugins/grafana-prometheusalerting-app/latest/configure-notifications/)
- [Monitor status](/docs/plugins/grafana-prometheusalerting-app/latest/monitor-status/)

The plugin uses Alertmanager terminology. For example, a contact point is a receiver, and a notification policy is a route.

## Legacy workflows in Grafana Alerting

The following topics describe how to work with data source-managed resources in the Grafana Alerting UI when the Prometheus Alerting plugin isn't installed:

- [Configure data source-managed alert rules](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/create-data-source-managed-rule/): Compare the two types of alert rules, and create alert rules that Mimir or Loki stores and evaluates.
- [Create data source-managed recording rules](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/create-data-source-managed-recording-rules/): Create recording rules that Mimir or Loki stores and evaluates.
- [Manage notification resources in other Alertmanagers](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/manage-alertmanager-resources/): Manage contact points, notification policies, mute timings, and silences in an Alertmanager other than the Grafana Alertmanager.

To add an Alertmanager to Grafana, or to send Grafana-managed alerts to it, refer to [Configure Alertmanagers](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/).

## Limitations

The legacy workflows in Grafana Alerting have the following limitations:

- **Supported data sources**: Grafana Alerting can retrieve alert rules and recording rules that are stored in most Prometheus, Loki, Mimir, and Alertmanager compatible data sources. It can't read or write alert rules that are stored in any other data source.
- **Supported versions**: The latest two minor versions of both Prometheus and Alertmanager are supported. Older versions might not work. For example, if the current Prometheus version is `2.31.1`, version `2.29.0` and later are supported.

## Meta monitor data source-managed alerts

To meta monitor alert rules that Mimir evaluates, you need a Prometheus or Mimir server, or another metrics database, to collect and store the metrics that the Mimir ruler exports.

The `rule_evaluation_failures_total` metric is a counter that shows the total number of rule evaluation failures.

To meta monitor Grafana-managed alerts, refer to [Meta monitoring](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/meta-monitoring/).
