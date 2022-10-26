---
aliases:
  - /docs/grafana/latest/alerting/contact-points/
  - /docs/grafana/latest/alerting/unified-alerting/contact-points/
description: Create or edit contact point
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - notification channel
  - create
title: Contact points
weight: 410
---

# Contact points

Use contact points to define how your contacts are notified when an alert fires. A contact point can have one or more contact point types, for example, email, slack, webhook, and so on. When an alert fires, a notification is sent to all contact point types listed for a contact point. Optionally, use message templating to customize notification messages for the contact point types.

You can configure Grafana managed contact points as well as contact points for an external Alertmanager data source.
