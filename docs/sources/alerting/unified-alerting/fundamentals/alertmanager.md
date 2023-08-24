+++
title = "Alertmanager"
aliases = ["/docs/grafana/v8.2/alerting/metrics/"]
weight = 116
+++

# Alertmanager

The Alertmanager helps both group and manage alert rules, adding a layer of orchestration on top of the alerting engines. To learn more, see [Prometheus Alertmanager documentation](https://prometheus.io/docs/alerting/latest/alertmanager/).

Grafana includes built-in support for Prometheus Alertmanager. By default, notifications for Grafana managed alerts are handled by the embedded Alertmanager that is part of core Grafana. You can configure the Alertmanager's contact points, notification policies, silences, and templates from the alerting UI by selecting the `Grafana` option from the Alertmanager drop-down.

> **Note:** Before v8.2, the configuration of the embedded Alertmanager was shared across organizations. If you are on an older Grafana version, we recommend that you use Grafana 8 Alerts only if you have one organization. Otherwise, your contact points are visible to all organizations.

Grafana 8 alerting added support for external Alertmanager configuration. When you add an [Alertmanager data source]({{< relref "../../../datasources/alertmanager.md" >}}), the Alertmanager drop-down shows a list of available external Alertmanager data sources. Select a data source to create and manage alerting for standalone Cortex or Loki data sources.

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" max-width="250px" caption="Select Alertmanager" >}}
