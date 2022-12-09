---
aliases:
  - ../message-templating/
  - ../unified-alerting/message-templating/
  - /docs/grafana/latest/alerting/contact-points/test-contact-point/
  - message-templating/
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Test a contact point
weight: 110
---

# Test a contact point

For Grafana managed contact points, you can send a test notification which helps verify a contact point is configured correctly.

To send a test notification:

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact** points.
1. Find the contact point to test, then click **Edit** (pen icon). You can also create a new contact point if needed.
1. Click **Test** (paper airplane icon) to open the contact point testing modal.
1. Choose whether to send a predefined test notification or choose custom to add your own custom annotations and labels to include in the notification.
1. Click **Send test notification** to fire the alert.
