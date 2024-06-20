---
aliases:
  - ../../alerting/alert-groups/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alert-groups/
  - ../../alerting/alert-groups/filter-alerts/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alert-groups/filter-alerts/
  - ../../alerting/alert-groups/view-alert-grouping/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alert-groups/view-alert-grouping/
  - ../../alerting/unified-alerting/alert-groups/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alert-groups/
  - ../../alerting/manage-notifications/view-notification-errors/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/view-notification-errors/
canonical: https://grafana.com/docs/grafana/latest/alerting/manage-notifications/view-alert-groups/
description: The Groups view lists the grouped alerts that are actively triggering notifications.
keywords:
  - grafana
  - alerting
  - alerts
  - errors
  - notifications
  - groups
labels:
  products:
    - cloud
    - enterprise
    - oss
title: View the status of notifications
weight: 800
refs:
  alertmanager:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
  grouping:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/
---

# View the status of notifications

The Groups view page lists grouped alerts that are actively triggering notifications.

By default, Alerting groups similar firing alerts (or alert instances) to prevent notification overload. For details on how notification grouping works, refer to [Group alert notifications](ref:grouping).

In the Groups view, you can see alert groups, check the state of their notifications, and also filter for alert instances that match specific criteria. This view is useful for debugging and verifying your grouping of notification policies.

## View alert groups and notification state

To view alert groups, complete the following steps.

1. Click **Alerts & IRM** -> **Alerting**.
1. Click **Groups** to view the list of groups firing notifications.

   By default, alert groups are grouped by the notification policies grouping.

   Each group displays its label set, contact point, and the number of alert instances (or alerts).

   Then, click on a group to access its alert instances. You can find alert instances by their label set and view their notification state.

### Notification states

The notification state of an alert instance can be in one of the following states:

- **Unprocessed**: The alert is received but its notification has not been processed yet.
- **Suppressed**: The alert has been silenced.
- **Active**: The alert notification has been handled. The alert is still firing and continues to be managed.

### Filter alerts

You can filter by label, state, or Alertmanager:

- **By label**: In **Search**, enter an existing label to view alerts matching the label. For example, `environment=production,region=~US|EU,severity!=warning`.

- **By state**: In **States**, select from Active, Suppressed, or Unprocessed states to view alerts matching your selected state. All other alerts are hidden.

- **By Alertmanager**: In the **Alertmanager** dropdown, select an [external Alertmanager](ref:alertmanager) to view only alert groups for that specific Alertmanager. By default, the `Grafana` Alertmanager is selected.

### Custom group

From **Custom group by** dropdown, select a combination of labels to view a grouping other than the default. This helps validate the [grouping of your notification policies](ref:grouping).

If an alert does not contain labels specified either in the grouping of the default policy or the custom grouping, then the alert is added to a catch all group with a header of `No grouping`.

## View notification errors

{{% admonition type="note" %}}

Notification errors are only available with [pre-configured Grafana Alertmanagers](ref:alertmanager).

{{% /admonition %}}

Notification errors provide information about why they failed to be sent or were not received.

To view notification errors, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.

   If any contact points are failing, a message at the right-hand corner of the screen alerts the user to the fact that there are errors and how many.

2. Click on the contact point to view the details of errors for each contact point.

   Error details are displayed if you hover over the Error icon.

   If a contact point has more than one integration, you see all errors for each of the integrations listed.

3. In the **Health** column, check the status of the notification.

   This can be either OK, No attempts, or Error.
