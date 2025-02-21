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
---

# Contact points

Contact points contain the configuration for sending alert notifications. You can assign a contact point either in the alert rule or notification policy options.

A contact point includes one or more contact point integrations for sending alert notifications, such as:

{{< column-list >}}

- Alertmanager
- Amazon SNS
- Cisco Webex Teams
- DingDing
- Discord
- Email
- Google Chat
- Grafana Oncall
- Kafka REST Proxy
- Line
- Microsoft Teams
- MQTT
- Opsgenie
- Pagerduty
- Pushover
- Sensu Go
- Slack
- Telegram
- Threema Gateway
- VictorOps
- Webhook
- WeCom

{{< /column-list >}}

For example, a contact point could contain a Pagerduty integration; an email and Slack integration; or a Pagerduty integration, a Slack integration, and two email integrations. You can also configure a contact point with no integrations; in which case no notifications are sent.

Each contact point integration can also define the notification message to be sent, which can use the predefined message, a custom message, or notification templates.

For a complete list of supported integrations and more details about contact points, refer to [Configure contact points](ref:configure-contact-points).
