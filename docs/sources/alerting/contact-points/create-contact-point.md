---
aliases:
  - ../message-templating/
  - ../unified-alerting/message-templating/
  - /docs/grafana/latest/alerting/contact-points/create-contact-point/
  - message-templating/
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Add contact point
weight: 100
---

# Add a contact point

Use contact points to define how your contacts are notified when an alert fires.

To add a contact point

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. Click **Contact points** to open the page listing existing contact points.
1. Click **New contact point**.
1. From the **Alertmanager** dropdown, select an Alertmanager. By default, Grafana Alertmanager is selected.
1. In **Name**, enter a descriptive name for the contact point.
1. From **Contact point type**, select a type and fill out mandatory fields. For example, if you choose email, enter the email addresses. Or if you choose Slack, enter the Slack channel(s) and users who should be contacted.
1. Some contact point types, like email or webhook, have optional settings. In **Optional settings**, specify additional settings for the selected contact point type.
1. In Notification settings, optionally select **Disable resolved message** if you do not want to be notified when an alert resolves.
1. To add another contact point type, click **New contact point type** and repeat steps 6 through 8.
1. Click **Save contact point** to save your changes.
