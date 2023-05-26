---
keywords:
  - grafana
  - alerting
  - notification
  - errors
  - contact points
description: View notification errors to find out why they weren't sent or received
title: View notification errors
weight: 900
---

# View notification errors

View notification errors and understand why they failed to be sent or were not received.

**Note:**
This feature only works if you are using Grafana Alertmanager.

To view notification errors, complete the following steps.

1. Navigate to Alerting -> Contact points.

   If any contact points are failing, a message at the right-hand corner of the screen alerts the user to the fact that there are errors and how many.

2. Click on the contact point to view the details of errors for each contact point.

   Error details are displayed if you hover over the Error icon.

   If a contact point has more than one integration, you see all errors for each of the integrations listed.

3. In the Health column, check the status of the notification.

   This can be either OK, No attempts, or Error.

## Useful links

[Receivers API](https://editor.swagger.io/?url=https://raw.githubusercontent.com/grafana/grafana/main/pkg/services/ngalert/api/tooling/post.json)
