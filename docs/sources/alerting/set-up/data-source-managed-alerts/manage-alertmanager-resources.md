---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/data-source-managed-alerts/manage-alertmanager-resources/
description: Manage contact points, notification policies, time intervals, and silences in an Alertmanager other than the Grafana Alertmanager from the Grafana Alerting UI
keywords:
  - grafana
  - alerting
  - Alertmanager
  - external Alertmanager
  - data source-managed
  - notifications
  - silences
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Manage other Alertmanagers
title: Manage notification resources in other Alertmanagers
weight: 300
---

# Manage notification resources in other Alertmanagers

Data source-managed alert rules send their alerts to an Alertmanager other than the built-in Grafana Alertmanager, such as a Mimir or Prometheus Alertmanager. After you [add the Alertmanager as a data source](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/#add-an-alertmanager), you can view and manage its notification resources in the Grafana Alerting UI.

The [Configure notifications](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/) documentation describes the Grafana Alertmanager only. This page describes what's different when you work with another Alertmanager.

{{< admonition type="note" >}}
The steps on this page don't apply when the [Prometheus Alerting](/docs/plugins/grafana-prometheusalerting-app/latest/) app plugin is installed and enabled. In that case, selecting another Alertmanager opens its routes, receivers, templates, silences, and time intervals in the plugin. Refer to [Configure notifications](/docs/plugins/grafana-prometheusalerting-app/latest/configure-notifications/) in the plugin documentation, and to [When the Prometheus Alerting plugin is installed](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/#when-the-prometheus-alerting-plugin-is-installed).
{{< /admonition >}}

## How Alertmanagers separate notification resources

Each Alertmanager manages its own independent notification resources:

- Contact points and notification templates
- Notification policies
- Mute timings and active time intervals
- Silences
- Active notifications

You can't share these resources across Alertmanagers. For example:

- A notification policy can only use contact points and time intervals from its own Alertmanager.
- Silences, mute timings, active time intervals, and inhibition rules only suppress notifications for alerts that the same Alertmanager handles.

By default, Grafana Alerting uses the Grafana Alertmanager, which only handles Grafana-managed alerts. Some existing Grafana Cloud stacks also include a Grafana Cloud Alertmanager.

## Select an Alertmanager

Before you view or change a notification resource, select the Alertmanager that it belongs to.

{{< figure src="/media/docs/alerting/alerting-choose-alertmanager.png" max-width="750px" alt="A screenshot choosing an Alertmanager in the notification policies UI" >}}

To select an Alertmanager, complete the following steps:

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Open the page for the resource you want to manage.

   | Resource                               | Page                                                          |
   | -------------------------------------- | ------------------------------------------------------------- |
   | Contact points                         | **Notification configuration**, **Contact points** tab        |
   | Notification policies                  | **Notification configuration**, **Notification policies** tab |
   | Notification templates                 | **Notification configuration**, **Templates** tab             |
   | Mute timings and active time intervals | **Notification configuration**, **Time intervals** tab        |
   | Silences                               | **Silences**                                                  |
   | Active notifications                   | **Alert activity**, **Active notifications** tab              |

1. From the **Choose Alertmanager** dropdown, select the Alertmanager. On some pages, the dropdown is named **Alertmanager**.

After you select the Alertmanager, the steps are the same as for the Grafana Alertmanager. Refer to the following topics:

- [Configure contact points](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/)
- [Configure notification policies](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-notification-policy/)
- [Configure mute timings and active time intervals](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/)
- [Configure silences](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/)
- [View active notifications](/docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-active-notifications/)

## Link to a silence form for another Alertmanager

When you [create a custom silence link](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/#url-link-to-a-silence-form), the link opens the silence form for the Grafana Alertmanager by default.

To link to the silence form for another Alertmanager, add an `alertmanager` query parameter with the name of the Alertmanager data source. For example:

```text
https://mygrafana/alerting/silence/new?alertmanager=<ALERTMANAGER_DATA_SOURCE_NAME>&matcher=severity%3Dcritical
```

## Limitations

Consider the following limitations when you manage another Alertmanager in the Grafana Alerting UI:

- **Prometheus Alertmanager**: You can manage silences, but contact points, notification policies, and notification templates are read-only because the Prometheus Alertmanager HTTP API doesn't support updates for these resources.
- **Images in notifications**: Other Alertmanagers don't support [images in notifications](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/images-in-notifications/).
- **Notification errors**: [Notification errors](/docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-active-notifications/#view-notification-errors) are only available for the Grafana Alertmanager.
- **Standalone Alertmanager UI in Grafana Cloud**: The standalone Alertmanager UI in Grafana Cloud, for example `https://alertmanager-<REGION>.grafana.net/alertmanager/`, is deprecated and no longer available. Use the Grafana Alerting UI instead.
