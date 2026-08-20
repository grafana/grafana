---
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-notification-history/
description: View the history of notifications sent by your Grafana-managed alert rules
keywords:
  - grafana
  - alerting
  - guide
  - notifications
  - history
  - view
labels:
  products:
    - cloud
    - enterprise
    - oss
title: View notification history
weight: 445
refs:
  view-alert-state-history:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-state-history/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/view-alert-state-history/
  view-active-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-active-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/view-active-notifications/
  contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# View notification history

View notifications that Grafana Alerting sent for your Grafana-managed alert rules from one page. Confirm delivery, see which contact point received each notification, and debug failures.

Grafana records a notification event each time it attempts to send a notification to a contact point for a group of alerts. Both firing and resolved notifications are recorded, so you'll see a complete delivery history even when an alert has already recovered.

Notification history is different from [active notifications](ref:view-active-notifications). Active notifications show alerts that are currently grouped and waiting to be sent. Notification history shows notifications that were already sent.

The **History** page also includes an **Alert events** tab for [alert state history](ref:view-alert-state-history).

{{< admonition type="note" >}}
Grafana OSS and Grafana Enterprise users must store notification history in Loki. Set `enabled = true` in the `[unified_alerting.notification_history]` section and configure the connection to Loki. Refer to [Before you begin](#before-you-begin).
{{< /admonition >}}

## Before you begin

Notification history stores Alertmanager notification logs in Loki. In Grafana OSS and Grafana Enterprise, configure the connection to Loki in the `[unified_alerting.notification_history]` section of your Grafana configuration file:

```ini
[unified_alerting.notification_history]
# Enable the notification history functionality in Unified Alerting.
# Alertmanager notification logs will be stored in Loki.
enabled = true

# URL of the Loki instance.
loki_remote_url = http://localhost:3100

# Optional tenant ID to attach to requests sent to Loki.
loki_tenant_id =

# Optional basic authentication for requests sent to Loki.
loki_basic_auth_username =
loki_basic_auth_password =
```

Replace `http://localhost:3100` with the URL of your Loki instance.

You can attach extra labels to every notification history record with the `[unified_alerting.notification_history.external_labels]` section.

In Grafana Cloud, notification history is managed for you. Contact support to enable it for your stack.

## View from the History page

The **History** page shows notifications sent for all Grafana-managed alert rules. Filter by labels, status, contact point, and delivery outcome.

You can only view notification history for alert rules you have permission to access.

To view notification history from the **History** page, follow these steps.

1. Click **Alerts & IRM** > **Alerting** > **History**.
1. Select the **Notifications** tab.

   Each row represents a notification sent to a contact point. The list shows the following columns:
   - **Time**: When the notification was sent.
   - **Status**: Whether the notification was for a **Firing** or **Resolved** alert.
   - **Group Labels**: The labels that identify the group of alerts included in the notification.
   - **Contact point**: The contact point and integration that received the notification.

   Failed notifications are marked with a **Failed** badge. Hover over the badge to see the error details.

1. Filter the list to narrow down the results:
   - **Labels**: Enter a label or click a label on a notification in the list.
   - **Status**: Filter by **Firing** or **Resolved**.
   - **Delivery outcome**: Show only successful or failed notifications.
   - **Contact point**: Filter by contact point.
   - **Time range**: Adjust the time range with the time picker.

1. Expand a row to see the alerts included in the notification, grouped into **Firing Alerts** and **Resolved Alerts**. Each alert shows its labels, annotations, summary, and description, and links to the alert rule that generated it.

## View the details of a single notification

Select **View** on a notification row to open its detail page.

The detail page shows the full context of the notification, including the contact point and integration used, the delivery outcome, any error returned, and the complete list of firing and resolved alerts that were included.

## View notification history for an alert rule

You can review notifications sent for a specific alert rule without leaving the rule.

To view notification history for an alert rule, follow these steps.

1. Click **Alerts & IRM** > **Alerting** > **Alert rules**.
1. Click an alert rule.
1. Select the **Notifications** tab.

The tab shows the same notification list as the **History** page, pre-filtered to alerts generated by that rule.

## Explore and query notification history

Because notification history is stored in Loki, you can query it directly in Loki through [Grafana Explore](ref:explore). Use Explore to build custom dashboards or run free-form investigations of your notification delivery.

## Next steps

- Refer to [View alert state history](ref:view-alert-state-history) to review alert state changes on the **Alert events** tab of the **History** page.
- Refer to [View active notifications](ref:view-active-notifications) to inspect alerts that are currently grouped and waiting to be sent.
- Refer to [Manage contact points](ref:contact-points) to configure where notifications are delivered.
