---
aliases:
  - ../contact-points/create-contact-point/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/create-contact-point/
  - ../contact-points/delete-contact-point/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/delete-contact-point/
  - ../contact-points/edit-contact-point/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/edit-contact-point/
  - ../contact-points/test-contact-point/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/test-contact-point/
  - ../manage-notifications/manage-contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/manage-contact-points/
  - ../alerting-rules/create-contact-point/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-contact-point/
  - ../alerting-rules/manage-contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/manage-contact-points/
  - ../alerting-rules/create-notification-policy/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-notification-policy/
  - ../alerting-rules/manage-contact-points/integrations/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/manage-contact-points/integrations/
  - ../manage-notifications/manage-contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/manage-contact-points/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/
description: Configure contact points to define how your contacts are notified when an alert rule fires
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure contact points
weight: 410
refs:
  webhook:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/
  pagerduty:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/pager-duty/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/pager-duty/
  oncall:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-oncall/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-oncall/
  slack:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-slack/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-slack/
---

# Configure contact points

Use contact points to select your preferred communication channel for receiving notifications when your alert rules are firing. You can add, edit, delete, export, and test a contact point.

{{% admonition type="note" %}}
You cannot delete contact points that are in use by a notification policy. Either delete the notification policy or update it to use another contact point.
{{% /admonition %}}

On the **Contact Points** tab, you can:

- Search for name and type of contact points and integrations
- View all existing contact points and integrations
- View how many notification policies each contact point is being used for and navigate directly to the linked notification policies
- View the status of notification deliveries
- Export individual contact points or all contact points in JSON, YAML, or Terraform format
- Delete contact points that are not in use by a notification policy

On the **Notification templates** tab, you can:

- View, edit, copy or delete existing notification templates

## Add a contact point

Complete the following steps to add a contact point.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Contact points**.
1. From the **Choose Alertmanager** dropdown, select an Alertmanager. By default, **Grafana Alertmanager** is selected.
1. On the **Contact Points** tab, click **+ Add contact point**.
1. Enter a descriptive name for the contact point.
1. From **Integration**, select a type and fill out mandatory fields. For example, if you choose email, enter the email addresses. Or if you choose Slack, enter the Slack channel and users who should be contacted.
1. Some contact point integrations, like email or Webhook, have optional settings. In **Optional settings**, specify additional settings for the selected contact point integration.
1. In Notification settings, optionally select **Disable resolved message** if you do not want to be notified when an alert resolves.
1. To add another contact point integration, click **Add contact point integration** and repeat steps 6 through 8.
1. Save your changes.

## Use notification templates

Use templates in contact points to customize your notifications.

Complete the following steps to add templates to your contact point.

1. Click an existing contact point or create a new one
1. In **Optional settings**, click any field that contains templates.

   For example, if you are creating an email contact point integration, click **Message** or **Subject**.

1. Click **Edit**.
   A dialog box opens where you can select templates.
1. [Optional] Click **Select existing template** to select a template and preview it using the default payload.

   Click **Save** to use just a single template in the field.

   You can also copy the selected template and use it in the custom tab.

1. [Optional] Click **Enter custom message** to customize and edit the field directly. Note that the title changes depending on the field you are editing.

   Click **Save** to use just a single template in the field.

1. You can switch between the two tabs to access the list of available templates and copy them across to the customized version.

1. Click **Save contact point**.

## Test a contact point

Complete the following steps to test a contact point.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Contact points** to view a list of existing contact points.
1. On the **Contact Points** tab, find the contact point you want to test, then click **Edit**. You can also create a new contact point if needed.
1. Click **Test** to open the contact point testing dialog box.
1. Choose whether to send a predefined test notification or choose custom to add your own custom annotations and labels to include in the notification.
1. Click **Send test notification** to fire the alert.

## Configure contact point integrations

Each contact point integration has its own configuration options and setup process. In most cases, this involves providing an API key or a Webhook URL.

After you have configured an integration, you can use it as part of your contact points to receive notifications whenever your alert changes its state. The following section covers the basic steps to configure your integrations, so you can start receiving real-time alerts and stay on top of your monitoring data.

## List of supported integrations

| Name                         | Type                      |
| ---------------------------- | ------------------------- |
| DingDing                     | `dingding`                |
| Discord                      | `discord`                 |
| Email                        | `email`                   |
| Google Chat                  | `googlechat`              |
| [Grafana Oncall](ref:oncall) | `oncall`                  |
| Hipchat                      | `hipchat`                 |
| Kafka                        | `kafka`                   |
| Line                         | `line`                    |
| Microsoft Teams              | `teams`                   |
| Opsgenie                     | `opsgenie`                |
| [Pagerduty](ref:pagerduty)   | `pagerduty`               |
| Prometheus Alertmanager      | `prometheus-alertmanager` |
| Pushover                     | `pushover`                |
| Sensu                        | `sensu`                   |
| Sensu Go                     | `sensugo`                 |
| [Slack](ref:slack)           | `slack`                   |
| Telegram                     | `telegram`                |
| Threema                      | `threema`                 |
| VictorOps                    | `victorops`               |
| [Webhook](ref:webhook)       | `webhook`                 |
