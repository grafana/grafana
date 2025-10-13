---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-discord/
description: Configure the Discord integration to receive notifications when your alerts are firing
keywords:
  - grafana
  - alerting
  - Discord
  - integration
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Discord
title: Configure Discord for Alerting
weight: 105
---

# Configure Discord for Alerting

Use the Grafana Alerting - Discord integration to receive alert notifications in your Discord channels when your Grafana alert rules are triggered and resolved.

## Before you begin

Create a Webhook to enable Grafana to send alert notifications to Discord channels.
To create a Webhook in Discord, complete the following steps.

1. Follow the steps in the [Intro to Webhooks guide](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).
1. Copy the Webhook URL.

## Procedure

To create your Discord integration in Grafana Alerting, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a contact point name.
1. From the Integration list, select **Discord**.
1. In the **Webhook URL** field, paste in your Webhook URL.
1. Click **Test** to check that your integration works.

   ** For Grafana Alertmanager only.**

   A test alert notification should be sent to the Discord channel that you associated with the Webhook.

1. Click **Save contact point**.

## Next steps

The Discord contact point is ready to receive alert notifications.

To add this contact point to your alert, complete the following steps.

1. In Grafana, navigate to **Alerting** > **Alert rules**.
1. Edit or create a new alert rule.
1. Scroll down to the **Configure labels and notifications** section.
1. Under **Notifications** click **Select contact point**.
1. From the drop-down menu, select the previously created contact point.
1. Click **Save rule and exit**.
