---
aliases:
  - ../message-templating/
  - ../unified-alerting/message-templating/
  - /docs/grafana/latest/alerting/contact-points/delete-contact-point/
  - message-templating/
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Delete a contact point
weight: 115
---

## Delete a contact point

For Grafana managed contact points, you can send a test notification which helps verify a contact point is configured correctly.

To delete a contact point

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. Find the contact point to delete, then click **Delete** (trash icon).
1. In the confirmation dialog, click **Yes, delete**.

> **Note:** You cannot delete contact points that are in use by a notification policy. You will have to either delete the [notification policy]({{< relref "../notifications/" >}}) or update it to use another contact point.
