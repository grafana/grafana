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
weight: 430
---

# Contact points

Use contact points to define how your contacts are notified when an alert fires. A contact point can have one or more contact point types, for example, email, slack, webhook, and so on. When an alert fires, a notification is sent to all contact point types listed for a contact point. Optionally, use [message templates]({{< relref "message-templating/_index.md" >}}) to customize notification messages for the contact point types.

You can configure Grafana managed contact points as well as contact points for an [external Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}). For more information, see [Alertmanager]({{< relref "../fundamentals/alertmanager.md" >}}).

Before you begin, see [About Grafana alerting]({{< relref "../about-alerting.md" >}}) which explains the various components of Grafana alerting. We also recommend that you familiarize yourself with some of the [fundamental concepts]({{< relref "../fundamentals/_index.md" >}}) of Grafana alerting.

- [Create contact point]({{< relref "./create-contact-point.md" >}})
- [Edit contact point]({{< relref "./edit-contact-point.md" >}})
- [Test contact point]({{< relref "./test-contact-point.md" >}})
- [Delete contact point]({{< relref "./delete-contact-point.md" >}})
- [List of notifiers]({{< relref "./notifiers/_index.md" >}})
- [Message templating]({{< relref "./message-templating/_index.md" >}})
