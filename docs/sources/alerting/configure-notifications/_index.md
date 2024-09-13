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
  contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/contact-points/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  templates-page:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/templates/
---

# Configure notifications

Choose how, when, and where to send your alert notifications.

As a first step, define your [contact points](ref:contact-points) where to send your alert notifications to. A contact point is a set of one or more integrations that are used to deliver notifications.

Next, create a [notification policy](ref:notification-policies) which is a set of rules for where, when and how your alerts are routed to contact points. In a notification policy, you define where to send your alert notifications by choosing one of the contact points you created.

Optionally, you can add [notification templates](ref:templates-page) to contact points for reuse and consistent messaging in your notifications.
