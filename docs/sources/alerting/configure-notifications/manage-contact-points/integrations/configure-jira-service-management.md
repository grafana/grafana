---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-jira-service-management/
description: Configure the Jira Service Management integration to receive notifications when your alerts are firing
keywords:
  - grafana
  - alerting
  - Jira
  - Jira Service Management
  - integration
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Jira Service Management
title: Configure Jira Service Management for Alerting
weight: 139
---

# Configure Jira Service Management for Alerting

Use the Grafana Alerting - Jira Service Management integration to receive alert notifications in your Jira alert dashboard when your Grafana alert rules are triggered and resolved.

## Before you begin

Create an API key to enable Grafana to send alert notifications to Jira Service Management alert dashboard.

To create an API key in Jira Service Management, complete the following steps.

1. [TBD]

## Procedure

To create your Jira Service Management integration in Grafana Alerting, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a contact point name.
1. From the **Integration** list, select **Jira Service Management**.
1. In the **API key** field, paste in your API key.
1. In the **Alert API URL**, enter [TBD]].
1. Click **Test** to check that your integration works.

   ** For Grafana Alertmanager only.**

   A test alert notification is sent to the Alerts page in Jira Service Management.

1. Click **Save contact point**.

## Next steps

The Jira Service Management contact point is ready to receive alert notifications.

To add this contact point to your alert rule, complete the following steps:

1. In Grafana, navigate to **Alerting** > **Alert rules**.
1. Edit or create a new alert rule.
1. Scroll down to the **Configure labels and notifications** section.
1. Under **Notifications**, click **Select contact point**.
1. From the drop-down menu, select the previously created contact point.
1. Click **Save rule and exit**.
