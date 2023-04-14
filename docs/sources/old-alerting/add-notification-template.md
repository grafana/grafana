---
aliases:
  - ../alerting/add-notification-template/
draft: true
keywords:
  - grafana
  - documentation
  - alerting
  - alerts
  - notification
  - templating
title: Alert notification templating
weight: 110
---

# Alert notification templating

You can provide detailed information to alert notification recipients by injecting alert query data into an alert notification. This topic explains how you can use alert query labels in alert notifications.

You can use labels generated during an alerting query evaluation to create alert notification messages. For multiple unique values for the same label, the values are comma-separated.

When an alert fires, the alerting data series indicates the violation. For resolved alerts, all data series are included in the resolved notification.

This topic explains how you can use alert query labels in alert notifications.

## Adding alert label data into your alert notification

1. Navigate to the panel you want to add or edit an alert rule for.
1. Click on the panel title, and then click **Edit**.
1. On the Alert tab, click **Create Alert**. If an alert already exists for this panel, then you can edit the alert directly.
1. Refer to the alert query labels in the alert rule name and/or alert notification message field by using the `${Label}` syntax.
1. Click **Save** in the upper right corner to save the alert rule and the dashboard.

![Alerting notification template](/static/img/docs/alerting/alert-notification-template-7-4.png)
