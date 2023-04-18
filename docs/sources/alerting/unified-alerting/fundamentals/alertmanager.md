---
aliases:
  - ../../metrics/
title: Alertmanager
weight: 116
---

# Alertmanager

The Alertmanager helps both group and manage alert rules, adding a layer of orchestration on top of the alerting engines. To learn more, see [Prometheus Alertmanager documentation](https://prometheus.io/docs/alerting/latest/alertmanager/).

Grafana includes built-in support for Prometheus Alertmanager. By default, notifications for Grafana managed alerts are handled by the embedded Alertmanager that is part of core Grafana. You can configure the Alertmanager's contact points, notification policies, silences, and templates from the alerting UI by selecting the `Grafana` option from the Alertmanager drop-down.

> **Note:** Before v8.2, the configuration of the embedded Alertmanager was shared across organizations. If you are on an older Grafana version, we recommend that you use Grafana alerts only if you have one organization. Otherwise, your contact points are visible to all organizations.

Grafana alerting added support for external Alertmanager configuration. When you add an [Alertmanager data source]({{< relref "../../../datasources/alertmanager.md" >}}), the Alertmanager drop-down shows a list of available external Alertmanager data sources. Select a data source to create and manage alerting for standalone Cortex or Loki data sources.

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" max-width="250px" caption="Select Alertmanager" >}}

You can configure one or several external Alertmanagers to receive alerts from Grafana. Once configured, both the embedded Alertmanager **and** any configured external Alertmanagers will receive _all_ alerts.

You can do the setup in the "Admin" tab within the Grafana v8 Alerts UI.

### Add a new external Alertmanager

1. In the Grafana menu, click the Alerting (bell) icon to open the Alerting page listing existing alerts.
2. Click **Admin** and then scroll down to the External Alertmanager section.
3. Click **Add Alertmanager** and a modal opens.
4. Add the URL and the port for the external Alertmanager. You do not need to specify the path suffix, for example, `/api/v(1|2)/alerts`. Grafana automatically adds this.

The external URL is listed in the table with a pending status. Once Grafana verifies that the Alertmanager is discovered, the status changes to active. No requests are made to the external Alertmanager at this point; the verification signals that alerts are ready to be sent.

### Edit an external Alertmanager

1. Click the pen symbol to the right of the Alertmanager row in the table.
2. When the edit modal opens, you can view all the URLs that were added.

The edited URL will be pending until Grafana verifies it again.

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/ext-alertmanager-active.png" max-width="650px" caption="External Alertmanagers" >}}
