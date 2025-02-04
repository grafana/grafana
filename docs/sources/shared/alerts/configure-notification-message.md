---
labels:
  products:
    - oss
title: 'Configure notification message'
---

## Configure notification message

Use [annotations](ref:shared-annotations) to add information to alert messages that can help respond to the alert.

Annotations are included by default in notification messages, and can use text or [templates](ref:shared-alert-rule-template) to display dynamic data from queries.

Grafana provides several optional annotations.

1. Optional: Add a summary.

   Short summary of what happened and why.

1. Optional: Add a description.

   Description of what the alert rule does.

1. Optional: Add a Runbook URL.

   Webpage where you keep your runbook for the alert

1. Optional: Add a custom annotation.

   Add any additional information that could help address the alert.

1. Optional: **Link dashboard and panel**.

   [Link the alert rule to a panel](ref:shared-link-alert-rules-to-panels) to facilitate alert investigation.

1. Click **Save rule**.
