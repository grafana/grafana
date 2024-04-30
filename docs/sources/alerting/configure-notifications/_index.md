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
---

# Configure notifications

Choose how, when, and where to send your alert notifications.

As a first step, define your [contact points][contact-points] where to send your alert notifications to. A contact point is a set of one or more integrations that are used to deliver notifications.

Next, create a [notification policy][notification-policies] which is a set of rules for where, when and how your alerts are routed to contact points. In a notification policy, you define where to send your alert notifications by choosing one of the contact points you created.

Optionally, you can add [notification templates][templates-page] to contact points for reuse and consistent messaging in your notifications.

{{% docs/reference %}}
[notification-policies]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies"
[notification-policies]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies"

[contact-points]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/contact-points"
[contact-points]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/contact-points"

[templates-page]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/templates/"
[templates-page]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/templates/"
{{% /docs/reference %}}
