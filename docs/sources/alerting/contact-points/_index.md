---
aliases:
  - unified-alerting/contact-points/
description: Create or edit contact point
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - notification channel
  - create
title: Contact points
weight: 430
---

# Contact points

Use contact points to define how your contacts are notified when an alert fires. A contact point can have one or more contact point types, for example, email, slack, webhook, and so on. When an alert fires, a notification is sent to all contact point types listed for a contact point. Optionally, use [message templates]({{< relref "message-templating/" >}}) to customize notification messages for the contact point types.

You can configure Grafana managed contact points as well as contact points for an [external Alertmanager data source]({{< relref "../../datasources/alertmanager/" >}}). For more information, see [Alertmanager]({{< relref "../fundamentals/alertmanager/" >}}).

Before you begin, see [Grafana Alerting]({{< relref "../../alerting/" >}}) which explains the various components of Grafana Alerting. We also recommend that you familiarize yourself with some of the [fundamental concepts]({{< relref "../fundamentals/" >}}) of Grafana Alerting.

- [Create contact point]({{< relref "create-contact-point/" >}})
- [Edit contact point]({{< relref "edit-contact-point/" >}})
- [Test contact point]({{< relref "test-contact-point/" >}})
- [Delete contact point]({{< relref "delete-contact-point/" >}})
- [List of notifiers]({{< relref "notifiers/" >}})
- [Message templating]({{< relref "message-templating/" >}})
