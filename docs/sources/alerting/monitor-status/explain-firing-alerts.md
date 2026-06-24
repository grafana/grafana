---
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/explain-firing-alerts/
description: Use Explain on the Alerts page to open Grafana Assistant and get context for a firing alert instance.
keywords:
  - grafana
  - alerting
  - assistant
  - explain
  - triage
labels:
  products:
    - cloud
    - enterprise
menuTitle: Explain firing alerts
title: Explain firing alerts
weight: 410
refs:
  alerts-page:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/alerts-page/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/alerts-page/
  generate-required-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/generate-required-annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/generate-required-annotations/
  annotation-label:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
---

{{< docs/public-preview product="Explain firing alerts" >}}

# Explain firing alerts

When a firing alert has an empty or vague [summary and description](ref:annotation-label), use **Explain** to open Grafana Assistant and get the context you need to triage.

## Use Explain

1. Go to **Alerts & IRM** → **Alerting** → **Alerts**.
1. Find a firing instance with little useful context in the notification.
1. Open **Instance details**, or use the action on the instance row.
1. Click **Explain**.

Grafana Assistant opens with information about the alert and related recent activity.

## What you get

Assistant helps you answer:

- What is this alert measuring?
- What else fired around the same service or environment?
- Are there related alerts with better summaries or descriptions you can use?

Use the response to decide what to do next — investigate, silence, declare an incident, or improve the alert rule.

## Improve the alert rule

If Assistant surfaces useful wording, edit the alert rule and update **Summary** and **Description** in **6. Configure notification message**. You can enter text manually or click **Autofill**. Refer to [Require and autofill annotations](ref:generate-required-annotations).

## Related documentation

- [Alerts overview page](ref:alerts-page)
