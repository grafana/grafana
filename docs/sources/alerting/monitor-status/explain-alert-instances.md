---
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/explain-alert-instances/
description: Use Explain and Grafana Assistant to add summary and description context to firing alert instances.
keywords:
  - grafana
  - alerting
  - assistant
  - explain
labels:
  products:
    - cloud
    - enterprise
menuTitle: Explain alert instances
title: Explain alert instances
weight: 415
refs:
  annotation-label:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
  generate-required-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/generate-required-annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/generate-required-annotations/
  incident-context-for-alerts:
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/irm/respond-to-alerts/incident-context-for-alerts/
---

{{< docs/public-preview product="Explain alert instances" >}}

# Explain alert instances

**Explain** uses Grafana Assistant to generate `summary` and `description` annotations for a firing alert instance when the rule does not provide enough context.

## Use Explain

1. Open a firing alert instance from **Alert rules** or **Alerts**.
1. Click **Explain**.

The Explain drawer shows:

- A proposed **summary** for notifications
- A proposed **description** with triage context
- Signals used in the response, such as similar alerts with good annotations, notification history, and [IRM incident context](/docs/grafana-cloud/alerting-and-irm/irm/respond-to-alerts/incident-context-for-alerts/)

## Add context to the alert rule

To persist generated text on the rule:

1. Review the proposed summary and description in the Explain drawer.
1. Click **Add this context to the alert**.
1. Confirm to update `annotations.summary` and `annotations.description` on the alert rule.

Future notifications use the updated annotations. Refer to [labels and annotations](ref:annotation-label) for annotation behavior.

## Assistant inputs

Explain sends the alert rule query, labels, existing annotations, and optionally:

- Notification history for the rule
- Similar alerts with existing summaries and descriptions
- Linked IRM incident history

## Related features

- [Require and generate annotations](ref:generate-required-annotations) — prevent missing annotations when creating rules
- [Incident context for alerts](ref:incident-context-for-alerts) — IRM history in Explain output
