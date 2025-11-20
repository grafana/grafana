---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-opsgenie/
description: Configure the Opsgenie integration to receive notifications when your alerts are firing
keywords:
  - grafana
  - alerting
  - Opsgenie
  - integration
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Opsgenie
title: Configure Opsgenie for Alerting
weight: 145
---

# Configure Opsgenie for Alerting

Use the Grafana Alerting - Opsgenie integration to receive alert notifications in your Opsgenie alert dashboard when your Grafana alert rules are triggered and resolved.

{{< admonition type="note" >}}
Atlassian has deprecated OpsGenie in favor of Jira.
{{< /admonition >}}

## Before you begin

Create an API key to enable Grafana to send alert notifications to Opsgenie alert dashboard.

To create an API key in Opsgenie, complete the following steps.

1. Follow the steps in the [API integration guide](https://support.atlassian.com/opsgenie/docs/create-a-default-api-integration/).

   Make sure you turn on the integration.

1. Copy the API key.

## Procedure

To create your Opsgenie integration in Grafana Alerting, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a contact point name.
1. From the **Integration** list, select **Opsgenie**.
1. In the **API key** field, paste in your API key.
1. Configure the **Alert API URL**.
   1. For Grafana Alertmanager, enter `https://api.opsgenie.com/v2/alerts`.
   1. For other Alertmanagers, enter the host for sending Opsgenie API requests, depending on the hosted region.
1. (Optional) Open the Optional OpsGenie settings dropdown and fill in the optional details.
   - **Message**: Text to be included with the alert.
   - **Description**: Description of the incident.
   - **Auto close incident**: Automatically close the alert in OpsGenie when the Grafana alert is resolved.
   - **Override priority**: Set the alert priority level. To use this, you need to add the `og_priority` label to your alert rules and set the priority level with the label value (for example, `og_priority=P1` for highest priority).
   - Send notification tags as: Send the common annotations to Opsgenie as either Extra Properties, Tags, or both.
1. Click **Test** to check that your integration works.

   **For Grafana Alertmanager only.**

   A test alert notification is sent to the Alerts page in Opsgenie.
1. Click **Save contact point**.

## Next steps

The Opsgenie contact point is ready to receive alert notifications.

To add this contact point to your alert rule, complete the following steps:

1. In Grafana, navigate to **Alerting** > **Alert rules**.
1. Edit or create a new alert rule.
1. Scroll down to the **Configure labels and notifications** section.
1. Under **Notifications**, click **Select contact point**.
1. From the drop-down menu, select the previously created contact point.
1. Click **Save rule and exit**.
