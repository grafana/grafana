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
  irm:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-irm/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-irm/
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
  configure-alertmanager:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
  manage-notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/manage-notification-templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/manage-notification-templates/
  jira:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-jira/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/integrations/configure-jira/
  configure-grafana-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
---

# Configure contact points

Use contact points to specify where to receive alert notifications. Contact points contain the configuration for sending alert notifications, including destinations like email, Slack, IRM, webhooks, and their notification messages.

A contact point can have one or multiple destinations, known as [contact point integrations](#supported-contact-point-integrations). Alert notifications are sent to each integration within the chosen contact point.

On the **Contact Points** tab, you can:

- Add, edit, and view contact points and integrations.
- Search for name and type of contact points and integrations.
- View how many notification policies each contact point is being used for and navigate directly to the linked notification policies.
- View the status of notification deliveries.
- Export individual contact points or all contact points in JSON, YAML, or Terraform format.
- Delete contact points. Note that you cannot delete contact points that are in use by a notification policy. To proceed, either delete the notification policy or update it to use another contact point.

{{% admonition type="note" %}}
Contact points are assigned to a [specific Alertmanager](ref:configure-alertmanager) and cannot be used by notification policies in other Alertmanagers.
{{% /admonition %}}

## Supported contact point integrations

Each contact point integration has its own configuration options and setup process. The following list shows the contact point integrations supported by Grafana.

{{< column-list >}}

- Alertmanager
- [AWS SNS](ref:sns)
- Cisco Webex Teams
- DingDing
- [Discord](ref:discord)
- [Email](ref:email)
- [Google Chat](ref:gchat)
- [Grafana IRM](ref:irm)
- Kafka REST Proxy
- [Jira](ref:jira)
- Line
- [Microsoft Teams](ref:teams)
- [MQTT](ref:mqtt)
- [Opsgenie](ref:opsgenie)
- [PagerDuty](ref:pagerduty)
- Pushover
- Sensu Go
- [Slack](ref:slack)
- [Telegram](ref:telegram)
- Threema Gateway
- VictorOps
- [Webhook](ref:webhook)
- WeCom

{{< /column-list >}}

Some of the integrations above are not supported by Prometheus Alertmanager. For the list of supported integrations, refer to the [Prometheus Alertmanager receiver settings](https://prometheus.io/docs/alerting/latest/configuration/#receiver-integration-settings).

## Add a contact point

Complete the following steps to add a contact point.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Contact points**.
1. From the **Choose Alertmanager** dropdown, select an Alertmanager. By default, **Grafana Alertmanager** is selected.
1. On the **Contact Points** tab, click **+ Add contact point**.
1. Enter a descriptive name for the contact point.
1. From **Integration**, select a type and fill out mandatory fields. For example, if you choose email, enter the email addresses. Or if you choose Slack, enter the Slack channel and users who should be contacted.
1. Some [contact point integrations](#supported-contact-point-integrations), like email or Webhook, have optional settings. In **Optional settings**, specify additional settings for the selected contact point integration.
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

## Customize notification messages

In contact points, you can also customize notification messages. For example, when setting up an email contact point integration, click **Message** or **Subject** to modify it.

By default, notification messages include common alert details, which are usually sufficient for most cases.

If necessary, you can customize the content and format of notification messages. You can create a custom notification template, which can then be applied to one or more contact points.

On the **Notification templates** tab, you can view, edit, copy or delete notification templates. Refer to [manage notification templates](ref:manage-notification-templates) for instructions on selecting or creating a template for a contact point.

## Test a contact point

Testing a contact point is only available for Grafana Alertmanager. Complete the following steps to test a contact point.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Contact points** to view a list of existing contact points.
1. On the **Contact Points** tab, find the contact point you want to test, then click **Edit**. You can also create a new contact point if needed.
1. Click **Test** to open the contact point testing dialog box.
1. Choose whether to send a predefined test notification or choose custom to add your own custom annotations and labels to include in the notification.
1. Click **Send test notification** to fire the alert.

## Enable notifications for a contact point

After creating a contact point, you can enable it to receive alert notifications using one of the following methods:

- **Assign it to alert rules** – Select the contact point in the [notifications options for Grafana-managed alert rules](ref:configure-grafana-alerts) to directly associate it with specific alerts.
- **Assign it to notification policies** – Add the contact point to one or more [notification policies](ref:configure-contact-points), which manage the alert notifications you want the contact point to receive.
