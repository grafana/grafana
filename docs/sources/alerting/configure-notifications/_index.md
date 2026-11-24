---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications
description: Configure how, when, and where to send your alert notifications
keywords:
  - grafana
  - alert
  - notifications
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure notifications
title: Configure notifications
weight: 125
---

# Configure notifications

Configuring how, when, and where to send alert notifications is an essential part of your alerting system.

By default, Grafana Alerting provides default notification messages with relevant alert information, so you don't need to configure messages initially. In the alert rule, you need to configure how to forward alerts:

1. Directly to a contact point.
2. To a contact point via notification policies (more flexible).

{{< figure src="/media/docs/alerting/alerting-configure-notifications-v2.png" max-width="750px" alt="In the alert rule, you can configure alert forwarding directly to a contact point or through notification policies" >}}

Notification setup is essential for an effective alerting system to scale across multiple teams and services. For a quick overview about the various components involved in handling notifications, refer to the [introduction about notifications](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/).

The topics in this section include step-by-step instructions for:

- [Configuring contact points](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/) to specify where to receive alert notifications.
- [Configuring notification policies](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-notification-policy/) to determine how alerts are routed to contact points.
- [Templating notifications](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/) to customize notification messages.
- [Configuring silences](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/) or [mute timings](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/) to stop notifications.
- [Configuring inhibition rules](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/inhibition-rules/) to suppress notifications for dependent alerts when a root-cause alert is already firing.

To convert an existing Prometheus or Mimir notification setup into Grafana-managed resources, refer to [Import Alertmanager configuration to Grafana-managed notifications](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/import-alertmanager-configuration/).

After you configure notifications, you can refer to [View notification history](/docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-notification-history/) to confirm delivery and troubleshoot failed notifications.

## Alertmanager architecture

Grafana Alerting is based on the Prometheus Alerting model, whose architecture decouples rule evaluation from notification handling.

- The alert rule evaluator, which is Grafana for Grafana-managed alert rules, evaluates alert rules and triggers alerts.
- The alert notification manager, known as the **Alertmanager**, receives alerts and manages their notifications.

{{< figure src="/media/docs/alerting/alerting-alertmanager-architecture.png" max-width="750px" alt="A diagram with the alert generator and alert manager architecture" >}}

Grafana includes a built-in Alertmanager, the **Grafana Alertmanager**, which receives all Grafana-managed alerts by default. The Grafana Alertmanager manages the notification resources described in this section, such as contact points, templates, notification policies, silences, mute timings, and active time intervals.

The topics in this section describe how to configure notifications in the Grafana Alertmanager.

You can also use other Alertmanagers with Grafana Alerting:

- To send Grafana-managed alerts to another Alertmanager, refer to [Configure Alertmanagers](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/).
- To manage the notification resources of another Alertmanager, such as a Mimir or Prometheus Alertmanager, refer to [Manage notification resources in other Alertmanagers](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/manage-alertmanager-resources/). Each Alertmanager manages its own independent notification resources, and you can't share them across Alertmanagers.
