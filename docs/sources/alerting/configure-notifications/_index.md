---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications
description: Configure how, when, and where to send your alert notifications
keywords:
  - grafana
  - alert
  - notifications
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure notifications
title: Configure notifications
weight: 125
refs:
  intro-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
  configure-notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-notification-policy/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-notification-policy/
  configure-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
  configure-silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
  configure-mute-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings/
---

# Configure notifications

Configuring how, when, and where to send alert notifications is an essential part of your alerting system.

By default, Grafana Alerting provides default notification messages with relevant alert information, so you don't need to configure messages initially. In the alert rule, you need to configure how to forward their alerts:

1. Directly to a contact point.
2. To a contact point via notification policies (more flexible).

{{< figure src="/media/docs/alerting/alerting-configure-notifications-v2.png" max-width="750px" alt="In the alert rule, you can configure to forward alerts directly to a contact point or through notification policies" >}}

The notification setup is essential for implementing an alerting system that can effectively scale across multiple teams and services. For a quick overview about the various components involved in handling notifications in Grafana Alerting, refer to the [introduction about notifications](ref:intro-notifications).

This section provides step-by-step instructions for:

- [Configuring contact points](ref:configure-contact-points) to specify where to receive alert notifications.
- [Configuring notification policies](ref:configure-notification-policies) to determine alerts are routed to contact points.
- [Templating notifications](ref:configure-templates) to customize notification messages.
- [Configuring silences](ref:configure-silences) or [mute timings](ref:configure-mute-timings) to stop notifications.
