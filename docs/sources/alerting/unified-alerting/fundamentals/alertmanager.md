+++
title = "Alertmanager"
aliases = ["/docs/grafana/latest/alerting/metrics/"]
weight = 116
+++

# Alertmanager

The Alertmanager helps both group and manage alert rules, adding a layer of orchestration on top of the alerting engines. To learn more, see [Prometheus Alertmanager documentation](https://prometheus.io/docs/alerting/latest/alertmanager/).

Grafana includes built-in support for Prometheus Alertmanager. By default, notifications for Grafana managed alerts are handled by the embedded Alertmanager that is part of core Grafana. You can configure the Alertmanager's contact points, notification policies, silences, and templates from the alerting UI by selecting the `Grafana` option from the Alertmanager drop-down.

> **Note:** Before v8.2, the configuration of the embedded Alertmanager was shared across organizations. If you are on an older Grafana version, we recommend that you use Grafana 8 Alerts only if you have one organization. Otherwise, your contact points are visible to all organizations.

Grafana 8 alerting added support for external Alertmanager configuration. When you add an [Alertmanager data source]({{< relref "../../../datasources/alertmanager.md" >}}), the Alertmanager drop-down shows a list of available external Alertmanager data sources. Select a data source to create and manage alerting for standalone Cortex or Loki data sources.

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" max-width="250px" caption="Select Alertmanager" >}}

## External Alertmanagers

It is possible to add one or many external alertmanagers to your alertmanager configuration. This will route your alerts to this/these alertmanager(s) as well as the internal one (??). This is done via the admin tab in the alerting ui.

### Add a new external Alertmanager

1. In the Grafana menu, click the Alerting (bell) icon to open the Alerting page listing existing alerts.
2. Click Admin
3. Scroll down to the External Alertmanager section
4. Click the Add Alertmanager button, a modal opens.
5. Add the url and eventual port to the alertmanager, there is no need to specify`/api/v(1|2)/alerts`. Grafana will add this.
6. The url will be shown in the table with a pending status, after a short while when Grafana has verified/connected/resolved it will change to active.

### Edit an external Alertmanager

1. Click the pen symbol to the right of the alertmanager row in the table.
2. The modal will open, and you will see all urls added. Change the url you want to update and click the Add Alertmanager button.
3. The edited url will be pending until Grafana has verified/connected/resolved.

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/ext-alertmanager-active.png" max-width="650px" caption="External Alertmanagers" >}}
