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
weight: 135
refs:
  notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
---

# Configure Microsoft Teams for Alerting

Use the Grafana Alerting - Microsoft Teams integration to receive notifications in your team’s channel when your alerts are firing.

Note that you can customize the `title` and `message` of the notification using [notification templates](ref:notification-templates); however, you cannot modify its visual appearance with adaptive cards.

## Before you begin

To set up Microsoft Teams for integration with Grafana Alerting, create a new workflow that accepts Webhook requests. This allows Grafana to send alert notifications to Microsoft Teams channels.

### Create a workflow in Microsoft Teams

1. To create a new workflow, follow the steps in [Create flows in Microsoft Teams](https://learn.microsoft.com/en-us/power-automate/teams/teams-app-create).
1. Microsoft provides a template library. You can use the template **Post to a channel when a webhook request is received**.
1. At the end of workflow creation wizard, copy the URL that is provided.

**Note**
If you chose a private channel for the target of the workflow, you need to edit workflow before using it. Expand the step "Send each adaptive card", and then expand action "Post your own adaptive card as the Flow bot to a channel". Change "Post as" to User, and save the workflow.

## Procedure

To create your MS Teams integration in Grafana Alerting, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a contact point name.
1. From the Integration list, select **Microsoft Teams**.
1. In the **URL** field, copy in your Webhook URL.
1. Click **Test** to check that your integration works.

   ** For Grafana Alertmanager only.**

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

## Troubleshooting

- If Grafana reports that notification was sent successfully but it was not delivered to the channel, check the workflow's run history. You can find it in the workflow details page.
