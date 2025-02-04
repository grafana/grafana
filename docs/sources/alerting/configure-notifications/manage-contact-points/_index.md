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
  sns:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-amazon-sns/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-amazon-sns/
  gchat:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-google-chat/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-google-chat/
  email:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-email/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-email/
  discord:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-discord/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-discord/
  telegram:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-telegram/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-telegram/
  webhook:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/
  opsgenie:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-opsgenie/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-opsgenie/
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
  teams:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-teams/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-teams/
  mqtt:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-mqtt/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-mqtt/
  alertmanager-architecture:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/#alertmanager-architecture
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/#alertmanager-architecture
  external-alertmanager:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
  manage-notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/manage-notification-templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/manage-notification-templates/
---

# Configure contact points

Use contact points to specify where to receive alert notifications. Contact points contain the configuration for sending alert notifications, including destinations like email, Slack, OnCall, webhooks, and their notification messages.

A contact point can have one or multiple destinations, known as [contact point integrations](#list-of-supported-integrations). Alert notifications are sent to each integration within the chosen contact point.

On the **Contact Points** tab, you can:

- Add, edit, and view contact points and integrations.
- Search for name and type of contact points and integrations.
- View how many notification policies each contact point is being used for and navigate directly to the linked notification policies.
- View the status of notification deliveries.
- Export individual contact points or all contact points in JSON, YAML, or Terraform format.
- Delete contact points. Note that you cannot delete contact points that are in use by a notification policy. To proceed, either delete the notification policy or update it to use another contact point.

{{% admonition type="note" %}}
Contact points are assigned to a [specific Alertmanager](ref:alertmanager-architecture) and cannot be used by notification policies in other Alertmanagers.
{{% /admonition %}}

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
1. Save your changes.

## Add another contact point integration

A contact point can have multiple integrations, or destinations for sending notifications.

To add another integration to a contact point, complete the following steps.

1. Add or edit an existing contact point.
1. Click **Add contact point integration** and repeat the same steps as [Add a contact point](#add-a-contact-point).
   - From **Integration**, select a type and fill out mandatory fields.
   - In **Optional settings**, specify additional settings for the selected contact point integration.
1. Save your changes.

## Test a contact point

Testing a contact point is only available for Grafana Alertmanager. Complete the following steps to test a contact point.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Contact points** to view a list of existing contact points.
1. On the **Contact Points** tab, find the contact point you want to test, then click **Edit**. You can also create a new contact point if needed.
1. Click **Test** to open the contact point testing dialog box.
1. Choose whether to send a predefined test notification or choose custom to add your own custom annotations and labels to include in the notification.
1. Click **Send test notification** to fire the alert.

## Customize notification messages

In contact points, you can also customize notification messages. For example, when setting up an email contact point integration, click **Message** or **Subject** to modify it.

By default, notification messages include common alert details, which are usually sufficient for most cases.

If necessary, you can customize the content and format of notification messages. You can create a custom notification template, which can then be applied to one or more contact points.

On the **Notification templates** tab, you can view, edit, copy or delete notification templates. Refer to [manage notification templates](ref:manage-notification-templates) for instructions on selecting or creating a template for a contact point.

## List of supported integrations

Each contact point integration has its own configuration options and setup process. In most cases, this involves providing an API key or a Webhook URL.

The following table lists the contact point integrations supported by Grafana.

| Name                         | Type                      |
| ---------------------------- | ------------------------- |
| Alertmanager                 | `prometheus-alertmanager` |
| [Amazon SNS](ref:sns)        | `sns`                     |
| Cisco Webex Teams            | `webex`                   |
| DingDing                     | `dingding`                |
| [Discord](ref:discord)       | `discord`                 |
| [Email](ref:email)           | `email`                   |
| [Google Chat](ref:gchat)     | `googlechat`              |
| [Grafana Oncall](ref:oncall) | `oncall`                  |
| Kafka REST Proxy             | `kafka`                   |
| Line                         | `line`                    |
| [Microsoft Teams](ref:teams) | `teams`                   |
| [MQTT](ref:mqtt)             | `mqtt`                    |
| [Opsgenie](ref:opsgenie)     | `opsgenie`                |
| [Pagerduty](ref:pagerduty)   | `pagerduty`               |
| Pushover                     | `pushover`                |
| Sensu Go                     | `sensugo`                 |
| [Slack](ref:slack)           | `slack`                   |
| [Telegram](ref:telegram)     | `telegram`                |
| Threema Gateway              | `threema`                 |
| VictorOps                    | `victorops`               |
| [Webhook](ref:webhook)       | `webhook`                 |
| WeCom                        | `wecom`                   |

Some of these integrations are not compatible with [external Alertmanagers](ref:external-alertmanager). For the list of Prometheus Alertmanager integrations, refer to the [Prometheus Alertmanager receiver settings](https://prometheus.io/docs/alerting/latest/configuration/#receiver-integration-settings).
