---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-teams/
description: Configure Microsoft Teams integration to receive notifications when your alerts are firing
keywords:
  - grafana
  - alerting
  - Microsoft Teams
  - integration
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Microsoft Teams
title: Configure Microsoft Teams for Alerting
weight: 50
---

# Configure Microsoft Teams for Alerting

Use the Grafana Alerting - Microsoft Teams integration to receive notifications in your team’s channel when your alerts are firing.

## Before you begin

To set up Microsoft Teams for integration with Grafana Alerting, you need to create an incoming Webhook. This allows Grafana to send alert notifications to Microsoft Teams channels.

### Create an incoming Webhook in Microsoft Teams

1. To add an incoming Webhook to a Teams channel, follow the steps in the [Create an Incoming Webhook guide](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook?tabs=newteams%2Cdotnet#create-an-incoming-webhook).

   Note: The steps to create incoming Webhooks may vary depending on the version of Microsoft Teams you are using. You can switch between the "New Teams" and "Classic Teams" tabs to view the relevant instructions for your version.

1. Copy the Webhook URL.

## Procedure

To create your MS Teams integration in Grafana Alerting, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a contact point name.
1. From the Integration list, select **Microsoft Teams**.
1. In the **URL** field, copy in your Webhook URL.
1. Click **Test** to check that your integration works.
   A test alert notification should be sent to the MS Team channel.
1. Click **Save** contact point.

## Next steps

The Microsoft Teams contact point is ready to receive alert notifications.

To add this contact point to your alert, complete the following steps.

1. In Grafana, navigate to **Alerting** > **Alert rules**.
1. Edit or create a new alert rule.
1. Scroll down to the **Configure labels and notifications** section.
1. Under Notifications click **Select contact point**.
1. From the drop-down menu, select the previously created contact point.
1. **Click Save rule and exit**.
