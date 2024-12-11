---
aliases:
  - ../../fundamentals/contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/
  - ../../fundamentals/contact-points/contact-point-types/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/contact-point-types/
  - ../../contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/
  - ../../unified-alerting/contact-points/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/contact-points/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/contact-points/
description: Learn about contact points and the supported contact point integrations
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - notification channel
  - create
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Contact points
weight: 112
refs:
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points
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
---

# Contact points

Contact points contain the configuration for sending alert notifications. You can assign a contact point either in the alert rule or notification policy options.

A contact point includes one or more contact point integrations for sending alert notifications, such as:

{{< column-list >}}

- [Amazon SNS](ref:sns)
- [Discord](ref:discord)
- [Email](ref:email)
- [Google Chat](ref:gchat)
- [Grafana Oncall](ref:oncall)
- [Microsoft Teams](ref:teams)
- [MQTT](ref:mqtt)
- [Opsgenie](ref:opsgenie)
- [Pagerduty](ref:pagerduty)
- [Slack](ref:slack)
- [Telegram](ref:telegram)
- [Webhook](ref:webhook)

{{< /column-list >}}

For example, a contact point could contain a Pagerduty integration; an email and Slack integration; or a Pagerduty integration, a Slack integration, and two email integrations. You can also configure a contact point with no integrations; in which case no notifications are sent.

Each contact point integration can also define the notification message to be sent, which can use the predefined message, a custom message, or notification templates.

For a complete list of supported integrations and more details about contact points, refer to [Configure contact points](ref:configure-contact-points).
