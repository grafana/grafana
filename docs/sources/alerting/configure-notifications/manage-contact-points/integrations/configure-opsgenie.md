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
1. In the **Alert API URL**, enter `https://api.opsgenie.com/v2/alerts`.
1. Click **Test** to check that your integration works.

   ** For Grafana Alertmanager only.**

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
